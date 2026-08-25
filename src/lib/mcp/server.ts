import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import type { SessionUser } from '@/lib/auth/session';
import { runAsActor } from '@/lib/auth/actor-context';
import { listBoards, getBoard } from '@/lib/actions/boards';
import {
  archiveTask,
  createTask,
  getBoardAssignableUsers,
  getTask,
  listArchivedTasks,
  listMyTasks,
  listTasks,
  searchTasks,
  unarchiveTask,
  updateTask,
  type TaskFilters,
} from '@/lib/actions/tasks';
import { createComment, listComments } from '@/lib/actions/comments';
import { recordOAuthAudit } from '@/lib/oauth/audit';
import { textToTiptap, tiptapToText } from './text';

const paginationSchema = {
  cursor: z.string().optional().describe('Opaque cursor returned by a previous call'),
  limit: z.number().int().min(1).max(100).default(50),
};
const toolOutputSchema = z.object({
  data: z.unknown().optional(),
  error: z.string().optional(),
});

type ToolPayload = Record<string, unknown>;

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const value = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid cursor');
  return value;
}

function page<T>(items: T[], cursor?: string, limit = 50) {
  const offset = decodeCursor(cursor);
  const data = items.slice(offset, offset + limit);
  return {
    items: data,
    nextCursor: offset + limit < items.length ? encodeCursor(offset + limit) : null,
    total: items.length,
  };
}

function serializeTask<T extends { description?: unknown }>(task: T) {
  const description = task.description as Parameters<typeof tiptapToText>[0];
  return { ...task, descriptionText: tiptapToText(description) };
}

function result(data: unknown) {
  const payload = { data } as ToolPayload;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function errorResult(message: string) {
  const payload = { error: message } as ToolPayload;
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    structuredContent: payload,
  };
}

function unwrap<T extends { success: boolean; error?: string }>(value: T): T {
  if (!value.success) throw new Error(value.error ?? 'Central operation failed');
  return value;
}

async function resolveTaskId(identifier: string): Promise<string> {
  const row = await db.query.tasks.findFirst({
    where: or(eq(tasks.id, identifier), eq(tasks.shortId, identifier)),
    columns: { id: true },
  });
  if (!row) throw new Error('Task not found');
  return row.id;
}

export function buildCentralMcpServer(input: {
  actor: SessionUser;
  clientId: string;
  scopes: string[];
}) {
  const { actor, clientId, scopes } = input;
  const server = new McpServer(
    { name: 'central', version: '1.0.0', title: 'Central' },
    { capabilities: { tools: {}, resources: {} } }
  );

  const run = async <T>(toolName: string, operation: () => Promise<T>) => {
    const started = Date.now();
    try {
      const value = await runAsActor(actor, operation);
      recordOAuthAudit({
        userId: actor.id,
        clientId,
        event: 'mcp.tool_called',
        toolName,
        outcome: 'success',
        durationMs: Date.now() - started,
      });
      return result(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Central operation failed';
      recordOAuthAudit({
        userId: actor.id,
        clientId,
        event: 'mcp.tool_called',
        toolName,
        outcome: 'error',
        durationMs: Date.now() - started,
      });
      return errorResult(message);
    }
  };

  server.registerTool(
    'boards_list',
    {
      title: 'List boards',
      description: 'List Central boards visible to the connected user.',
      inputSchema: z.object({ client_id: z.string().uuid().optional(), ...paginationSchema }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ client_id, cursor, limit }) =>
      run('boards_list', async () => {
        const response = unwrap(await listBoards(client_id));
        return page(response.data ?? [], cursor, limit);
      })
  );

  server.registerTool(
    'board_get',
    {
      title: 'Get board',
      description: 'Get a board, its workflow statuses and sections, and users assignable to its tasks.',
      inputSchema: z.object({ board_id: z.string().uuid() }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ board_id }) =>
      run('board_get', async () => {
        const [boardResponse, usersResponse] = await Promise.all([
          getBoard(board_id),
          getBoardAssignableUsers(board_id),
        ]);
        const board = unwrap(boardResponse).data;
        if (!board) throw new Error('Board not found or access denied');
        const { access, ...safeBoard } = board;
        void access;
        return { ...safeBoard, assignableUsers: unwrap(usersResponse).users ?? [] };
      })
  );

  server.registerTool(
    'tasks_list',
    {
      title: 'List tasks',
      description: 'List tasks on a board with optional workflow, assignee, parent, due-date, and archive filters.',
      inputSchema: z.object({
        board_id: z.string().uuid(),
        status: z.array(z.string()).optional(),
        section: z.array(z.string()).optional(),
        assignee_ids: z.array(z.string().uuid()).optional(),
        parent_task_id: z.string().optional(),
        due_before: z.iso.date().optional(),
        due_after: z.iso.date().optional(),
        include_archived: z.boolean().default(false),
        ...paginationSchema,
      }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ board_id, status, section, assignee_ids, parent_task_id, due_before, due_after, include_archived, cursor, limit }) =>
      run('tasks_list', async () => {
        const filters: TaskFilters = {
          status,
          section,
          assigneeId: assignee_ids,
        };
        const response = unwrap(await listTasks(board_id, filters));
        let active: unknown[] = (response.tasks ?? []).filter((task) => {
          if (parent_task_id && task.parentTaskId !== parent_task_id) return false;
          if (due_before && (!task.dueDate || task.dueDate > due_before)) return false;
          if (due_after && (!task.dueDate || task.dueDate < due_after)) return false;
          return true;
        }).map(serializeTask);
        if (include_archived) {
          const archived = unwrap(await listArchivedTasks(board_id)).tasks ?? [];
          active = [...active, ...archived.map((task) => ({ ...task, descriptionText: null }))];
        }
        return page(active, cursor, limit);
      })
  );

  server.registerTool(
    'tasks_search',
    {
      title: 'Search tasks',
      description: 'Search task titles across every board visible to the connected user.',
      inputSchema: z.object({ query: z.string().trim().min(2).max(200) }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ query }) => run('tasks_search', async () => unwrap(await searchTasks(query)).results ?? [])
  );

  server.registerTool(
    'tasks_list_mine',
    {
      title: 'List my tasks',
      description: 'List tasks assigned to the connected Central user, including client and board context.',
      inputSchema: z.object(paginationSchema),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ cursor, limit }) =>
      run('tasks_list_mine', async () => {
        const groups = unwrap(await listMyTasks()).tasksByClient ?? [];
        const flattened = groups.flatMap((group) =>
          group.tasks.map((task) => serializeTask({ ...task, client: group.client }))
        );
        return page(flattened, cursor, limit);
      })
  );

  server.registerTool(
    'task_get',
    {
      title: 'Get task',
      description: 'Get a task by UUID or Central short ID.',
      inputSchema: z.object({ task_id: z.string().min(1) }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ task_id }) =>
      run('task_get', async () => {
        const resolved = await resolveTaskId(task_id);
        const task = unwrap(await getTask(resolved)).task;
        if (!task) throw new Error('Task not found or access denied');
        return serializeTask(task);
      })
  );

  server.registerTool(
    'comments_list',
    {
      title: 'List comments',
      description: 'List comments for an accessible task.',
      inputSchema: z.object({ task_id: z.string().min(1), ...paginationSchema }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ task_id, cursor, limit }) =>
      run('comments_list', async () => {
        const resolved = await resolveTaskId(task_id);
        const comments = unwrap(await listComments(resolved)).comments ?? [];
        return page(
          comments.map((comment) => ({ ...comment, contentText: tiptapToText(comment.content) })),
          cursor,
          limit
        );
      })
  );

  if (scopes.includes('central:write')) {
    server.registerTool(
      'task_create',
      {
        title: 'Create task',
        description: 'Create a task or single-level subtask on an accessible Central board.',
        inputSchema: z.object({
          board_id: z.string().uuid(),
          title: z.string().trim().min(1).max(500),
          description: z.string().max(50_000).optional(),
          status: z.string().optional(),
          section: z.string().optional(),
          due_date: z.iso.date().optional(),
          date_flexibility: z.enum(['not_set', 'flexible', 'semi_flexible', 'not_flexible']).optional(),
          assignee_ids: z.array(z.string().uuid()).max(50).optional(),
          parent_task_id: z.string().optional(),
        }),
        outputSchema: toolOutputSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      ({ board_id, title, description, status, section, due_date, date_flexibility, assignee_ids, parent_task_id }) =>
        run('task_create', async () => {
          const board = unwrap(await getBoard(board_id)).data;
          if (!board) throw new Error('Board not found or access denied');
          const response = unwrap(
            await createTask({
              boardId: board_id,
              title,
              descriptionJson: description ? JSON.stringify(textToTiptap(description)) : undefined,
              status: status ?? board.statusOptions[0]?.id ?? 'todo',
              section,
              dueDate: due_date,
              dateFlexibility: date_flexibility,
              assigneeIds: assignee_ids,
              parentTaskId: parent_task_id ? await resolveTaskId(parent_task_id) : undefined,
            })
          );
          if (!response.task) throw new Error('Task creation failed');
          return serializeTask(response.task);
        })
    );

    server.registerTool(
      'task_update',
      {
        title: 'Update task',
        description: 'Update task fields, assignees, and optionally complete all of a parent task’s subtasks.',
        inputSchema: z.object({
          task_id: z.string().min(1),
          title: z.string().trim().min(1).max(500).optional(),
          description: z.string().max(50_000).nullable().optional(),
          status: z.string().optional(),
          section: z.string().nullable().optional(),
          due_date: z.iso.date().nullable().optional(),
          date_flexibility: z.enum(['not_set', 'flexible', 'semi_flexible', 'not_flexible']).optional(),
          assignee_ids: z.array(z.string().uuid()).max(50).optional(),
          complete_subtasks: z.boolean().optional(),
        }),
        outputSchema: toolOutputSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      ({ task_id, title, description, status, section, due_date, date_flexibility, assignee_ids, complete_subtasks }) =>
        run('task_update', async () => {
          const response = unwrap(
            await updateTask({
              id: await resolveTaskId(task_id),
              title,
              descriptionJson:
                description === undefined
                  ? undefined
                  : description === null
                    ? null
                    : JSON.stringify(textToTiptap(description)),
              status,
              section,
              dueDate: due_date,
              dateFlexibility: date_flexibility,
              assigneeIds: assignee_ids,
              completeSubtasks: complete_subtasks,
            })
          );
          if (!response.task) throw new Error('Task update failed');
          return serializeTask(response.task);
        })
    );

    server.registerTool(
      'task_archive',
      {
        title: 'Archive completed task',
        description: 'Archive a completed task and its subtasks. This is reversible with task_unarchive.',
        inputSchema: z.object({ task_id: z.string().min(1) }),
        outputSchema: toolOutputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      ({ task_id }) =>
        run('task_archive', async () => {
          unwrap(await archiveTask(await resolveTaskId(task_id)));
          return { archived: true };
        })
    );

    server.registerTool(
      'task_unarchive',
      {
        title: 'Unarchive task',
        description: 'Restore an archived task and the related parent or subtasks.',
        inputSchema: z.object({ task_id: z.string().min(1) }),
        outputSchema: toolOutputSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      ({ task_id }) =>
        run('task_unarchive', async () => {
          unwrap(await unarchiveTask(await resolveTaskId(task_id)));
          return { archived: false };
        })
    );

    server.registerTool(
      'comment_add',
      {
        title: 'Add comment',
        description: 'Add a plain-text or Markdown comment to an accessible task, optionally as a one-level reply.',
        inputSchema: z.object({
          task_id: z.string().min(1),
          content: z.string().trim().min(1).max(50_000),
          parent_comment_id: z.string().uuid().optional(),
        }),
        outputSchema: toolOutputSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      ({ task_id, content, parent_comment_id }) =>
        run('comment_add', async () => {
          const response = unwrap(
            await createComment({
              taskId: await resolveTaskId(task_id),
              contentJson: JSON.stringify(textToTiptap(content)),
              parentCommentId: parent_comment_id,
            })
          );
          if (!response.comment) throw new Error('Comment creation failed');
          return { ...response.comment, contentText: tiptapToText(response.comment.content) };
        })
    );
  }

  const readResource = async (operation: () => Promise<unknown>) => {
    const value = await runAsActor(actor, operation);
    return JSON.stringify(value, null, 2);
  };

  server.registerResource(
    'boards',
    'central://boards',
    { title: 'Central boards', description: 'Boards visible to the connected user', mimeType: 'application/json' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: await readResource(async () => unwrap(await listBoards()).data ?? []),
        },
      ],
    })
  );

  server.registerResource(
    'board',
    new ResourceTemplate('central://boards/{boardId}', { list: undefined }),
    { title: 'Central board', description: 'Board workflow configuration', mimeType: 'application/json' },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: await readResource(async () => {
            const board = unwrap(await getBoard(String(variables.boardId))).data;
            if (!board) throw new Error('Board not found or access denied');
            const { access, ...safeBoard } = board;
            void access;
            return safeBoard;
          }),
        },
      ],
    })
  );

  server.registerResource(
    'board-tasks',
    new ResourceTemplate('central://boards/{boardId}/tasks', { list: undefined }),
    { title: 'Central board tasks', description: 'Active tasks on a board', mimeType: 'application/json' },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: await readResource(async () =>
            (unwrap(await listTasks(String(variables.boardId))).tasks ?? []).map(serializeTask)
          ),
        },
      ],
    })
  );

  server.registerResource(
    'task',
    new ResourceTemplate('central://tasks/{taskId}', { list: undefined }),
    { title: 'Central task', description: 'Task detail by UUID or short ID', mimeType: 'application/json' },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: await readResource(async () => {
            const response = unwrap(await getTask(await resolveTaskId(String(variables.taskId))));
            if (!response.task) throw new Error('Task not found or access denied');
            return serializeTask(response.task);
          }),
        },
      ],
    })
  );

  server.registerResource(
    'task-comments',
    new ResourceTemplate('central://tasks/{taskId}/comments', { list: undefined }),
    { title: 'Central task comments', description: 'Comments for a task', mimeType: 'application/json' },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: await readResource(async () =>
            (unwrap(await listComments(await resolveTaskId(String(variables.taskId)))).comments ?? []).map(
              (comment) => ({ ...comment, contentText: tiptapToText(comment.content) })
            )
          ),
        },
      ],
    })
  );

  return server;
}
