# API & Server Actions Documentation

## Overview

This application uses **Next.js Server Actions** as the primary API layer. Server Actions provide:
- Type-safe function calls from client to server
- Automatic form integration
- Built-in error handling
- No need for separate API routes in most cases

Traditional API routes (`/api/*`) are used for:
- Webhooks (Slack, Uploadthing, Inngest)
- Auth.js callbacks
- External integrations

---

## Server Actions Structure

```
/lib
  /actions
    /auth.ts          # Authentication actions
    /clients.ts       # Client CRUD
    /boards.ts        # Board CRUD
    /tasks.ts         # Task CRUD
    /comments.ts      # Comment CRUD
    /attachments.ts   # Attachment management
    /notifications.ts # Notification actions
    /users.ts         # User management
    /teams.ts         # Team management
    /invitations.ts   # Invitation management
    /rollups.ts       # Rollup board actions
```

---

## Authentication Actions

### `/lib/actions/auth.ts`

```typescript
'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, invitations } from '@/lib/db/schema';
import { hash, verify } from '@/lib/utils/password';

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/my-tasks' });
}

/**
 * Sign in with email and password
 */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // Validation, sign in logic
}

/**
 * Register new user (requires valid invitation for non-@clix.co emails)
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  invitationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Check if @clix.co or has valid invitation
  // Hash password, create user
}

/**
 * Accept invitation and create account
 */
export async function acceptInvitation(
  invitationId: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  // Validate invitation not expired
  // Create user with invitation's role/team
  // Mark invitation as accepted
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  await signOut({ redirectTo: '/login' });
}
```

---

## Client Actions

### `/lib/actions/clients.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, getCurrentUser } from '@/lib/auth/session';

// Types
interface CreateClientInput {
  name: string;
  slug: string;
  color?: string;
}

interface UpdateClientInput {
  id: string;
  name?: string;
  slug?: string;
  color?: string;
}

/**
 * Get all clients (admin sees all, users see accessible only)
 */
export async function getClients(): Promise<Client[]> {
  const user = await getCurrentUser();

  if (user.role === 'admin') {
    return db.query.clients.findMany({
      orderBy: (clients, { asc }) => [asc(clients.name)],
    });
  }

  // Get clients where user has access to at least one board
  return db.query.clients.findMany({
    where: (clients, { exists, and, eq, or }) =>
      exists(
        db.select()
          .from(boards)
          .innerJoin(boardAccess, eq(boards.id, boardAccess.boardId))
          .where(
            and(
              eq(boards.clientId, clients.id),
              or(
                eq(boardAccess.userId, user.id),
                // Team membership check...
              )
            )
          )
      ),
    orderBy: (clients, { asc }) => [asc(clients.name)],
  });
}

/**
 * Get single client by slug
 */
export async function getClientBySlug(slug: string): Promise<Client | null> {
  // Permission check included
}

/**
 * Create new client (admin only)
 */
export async function createClient(input: CreateClientInput): Promise<{
  success: boolean;
  client?: Client;
  error?: string;
}> {
  await requireAdmin();

  // Validate slug uniqueness
  // Create client
  // Revalidate paths

  revalidatePath('/clients');
  revalidatePath('/(dashboard)', 'layout'); // Sidebar update
}

/**
 * Update client (admin only)
 */
export async function updateClient(input: UpdateClientInput): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();
  // Update logic
  revalidatePath(`/clients/${slug}`);
}

/**
 * Delete client (admin only)
 * Also deletes all boards and tasks within
 */
export async function deleteClient(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();
  // Cascade delete handled by DB constraints
  revalidatePath('/clients');
}
```

---

## Board Actions

### `/lib/actions/boards.ts`

```typescript
'use server';

interface CreateBoardInput {
  clientId: string;
  name: string;
  statusOptions: StatusOption[];
  sectionOptions?: SectionOption[];
}

interface UpdateBoardInput {
  id: string;
  name?: string;
  statusOptions?: StatusOption[];
  sectionOptions?: SectionOption[];
}

interface BoardAccessInput {
  boardId: string;
  userId?: string;
  teamId?: string;
  accessLevel: 'full' | 'assigned_only';
}

/**
 * Get boards for a client
 */
export async function getBoardsForClient(clientId: string): Promise<Board[]> {
  const user = await getCurrentUser();
  // Filter by user's access permissions
}

/**
 * Get single board with permission check
 */
export async function getBoard(boardId: string): Promise<{
  board: Board | null;
  permission: BoardPermission | null;
}> {
  const user = await getCurrentUser();
  const permission = await getBoardPermission(user.id, boardId);

  if (!permission) {
    return { board: null, permission: null };
  }

  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    with: {
      client: true,
    },
  });

  return { board, permission };
}

/**
 * Create board (admin only)
 */
export async function createBoard(input: CreateBoardInput): Promise<{
  success: boolean;
  board?: Board;
  error?: string;
}> {
  await requireAdmin();

  // Create board with default status options if not provided
  const defaultStatuses: StatusOption[] = [
    { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
    { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
    { id: 'review', label: 'Review', color: '#F59E0B', position: 2 },
    { id: 'complete', label: 'Complete', color: '#10B981', position: 3 },
  ];

  // Insert board
  // Revalidate paths
}

/**
 * Update board settings (admin only)
 */
export async function updateBoard(input: UpdateBoardInput): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();
  // Update logic
}

/**
 * Delete board (admin only)
 */
export async function deleteBoard(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();
  // Delete logic with cascade
}

/**
 * Grant board access to user or team (admin only)
 */
export async function grantBoardAccess(input: BoardAccessInput): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();
  // Upsert board_access record
}

/**
 * Revoke board access (admin only)
 */
export async function revokeBoardAccess(
  boardId: string,
  userId?: string,
  teamId?: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  // Delete board_access record
}

/**
 * Get board access list (admin only)
 */
export async function getBoardAccessList(boardId: string): Promise<BoardAccessEntry[]> {
  await requireAdmin();
  // Return all access entries with user/team details
}
```

---

## Task Actions

### `/lib/actions/tasks.ts`

```typescript
'use server';

interface CreateTaskInput {
  boardId: string;
  title: string;
  description?: TiptapContent;
  status: string;
  section?: string;
  dueDate?: string;
  dateFlexibility?: DateFlexibility;
  assigneeIds?: string[];
  recurringConfig?: RecurringConfig;
}

interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: TiptapContent;
  status?: string;
  section?: string;
  dueDate?: string | null;
  dateFlexibility?: DateFlexibility;
  assigneeIds?: string[];
  recurringConfig?: RecurringConfig | null;
  position?: number;
}

interface ReorderTasksInput {
  boardId: string;
  status: string;
  taskIds: string[]; // Ordered list of task IDs
}

/**
 * Get tasks for a board (with permission filtering)
 */
export async function getTasksForBoard(boardId: string): Promise<Task[]> {
  const user = await getCurrentUser();
  const permission = await getBoardPermission(user.id, boardId);

  if (!permission) {
    throw new Error('Access denied');
  }

  let query = db.select().from(tasks).where(eq(tasks.boardId, boardId));

  // Apply assigned_only filter if needed
  if (permission.viewScope === 'assigned_only') {
    query = query.innerJoin(
      taskAssignees,
      and(
        eq(tasks.id, taskAssignees.taskId),
        eq(taskAssignees.userId, user.id)
      )
    );
  }

  return query.orderBy(tasks.status, tasks.position);
}

/**
 * Get single task with details
 */
export async function getTask(taskId: string): Promise<TaskWithDetails | null> {
  const user = await getCurrentUser();
  // Permission check via board access
  // Return task with assignees, attachments count, comments count
}

/**
 * Get all tasks assigned to current user (personal rollup)
 */
export async function getMyTasks(options?: {
  excludeBoardIds?: string[];
}): Promise<TaskWithBoardInfo[]> {
  const user = await getCurrentUser();

  return db.query.tasks.findMany({
    where: (tasks, { and, notInArray }) => and(
      exists(
        db.select()
          .from(taskAssignees)
          .where(
            and(
              eq(taskAssignees.taskId, tasks.id),
              eq(taskAssignees.userId, user.id)
            )
          )
      ),
      options?.excludeBoardIds?.length
        ? notInArray(tasks.boardId, options.excludeBoardIds)
        : undefined
    ),
    with: {
      board: {
        with: {
          client: true,
        },
      },
      assignees: {
        with: {
          user: true,
        },
      },
    },
    orderBy: (tasks, { asc, desc }) => [
      asc(tasks.dueDate),
      desc(tasks.createdAt),
    ],
  });
}

/**
 * Create new task
 */
export async function createTask(input: CreateTaskInput): Promise<{
  success: boolean;
  task?: Task;
  error?: string;
}> {
  const user = await getCurrentUser();
  const permission = await getBoardPermission(user.id, input.boardId);

  if (!permission) {
    return { success: false, error: 'Access denied' };
  }

  // Get max position for the status
  const maxPosition = await db.select({ max: max(tasks.position) })
    .from(tasks)
    .where(and(
      eq(tasks.boardId, input.boardId),
      eq(tasks.status, input.status)
    ));

  // Create task
  const [task] = await db.insert(tasks).values({
    boardId: input.boardId,
    title: input.title,
    description: input.description,
    status: input.status,
    section: input.section,
    dueDate: input.dueDate,
    dateFlexibility: input.dateFlexibility ?? 'not_set',
    recurringConfig: input.recurringConfig,
    position: (maxPosition[0]?.max ?? -1) + 1,
    createdBy: user.id,
  }).returning();

  // Add assignees
  if (input.assigneeIds?.length) {
    await db.insert(taskAssignees).values(
      input.assigneeIds.map(userId => ({
        taskId: task.id,
        userId,
      }))
    );

    // Trigger assignment notifications
    await triggerAssignmentNotifications(task.id, input.assigneeIds, user.id);
  }

  // Extract and process mentions from description
  if (input.description) {
    const mentions = extractMentions(input.description);
    await triggerMentionNotifications(task.id, null, mentions, user.id);
  }

  revalidatePath(`/clients/[slug]/boards/${input.boardId}`);
  return { success: true, task };
}

/**
 * Update task
 */
export async function updateTask(input: UpdateTaskInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, input.id),
  });

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  const permission = await getBoardPermission(user.id, task.boardId);
  if (!permission) {
    return { success: false, error: 'Access denied' };
  }

  // Update task fields
  await db.update(tasks)
    .set({
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status && { status: input.status }),
      ...(input.section !== undefined && { section: input.section }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.dateFlexibility && { dateFlexibility: input.dateFlexibility }),
      ...(input.recurringConfig !== undefined && { recurringConfig: input.recurringConfig }),
      ...(input.position !== undefined && { position: input.position }),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, input.id));

  // Handle assignee changes
  if (input.assigneeIds !== undefined) {
    const currentAssignees = await db.query.taskAssignees.findMany({
      where: eq(taskAssignees.taskId, input.id),
    });

    const currentIds = new Set(currentAssignees.map(a => a.userId));
    const newIds = new Set(input.assigneeIds);

    // Remove old assignees
    const toRemove = [...currentIds].filter(id => !newIds.has(id));
    if (toRemove.length) {
      await db.delete(taskAssignees)
        .where(and(
          eq(taskAssignees.taskId, input.id),
          inArray(taskAssignees.userId, toRemove)
        ));
    }

    // Add new assignees
    const toAdd = [...newIds].filter(id => !currentIds.has(id));
    if (toAdd.length) {
      await db.insert(taskAssignees).values(
        toAdd.map(userId => ({ taskId: input.id, userId }))
      );
      await triggerAssignmentNotifications(input.id, toAdd, user.id);
    }
  }

  revalidatePath(`/clients/[slug]/boards/${task.boardId}`);
  return { success: true };
}

/**
 * Reorder tasks within a status (drag and drop)
 */
export async function reorderTasks(input: ReorderTasksInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  const permission = await getBoardPermission(user.id, input.boardId);

  if (!permission) {
    return { success: false, error: 'Access denied' };
  }

  // Update positions in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < input.taskIds.length; i++) {
      await tx.update(tasks)
        .set({ position: i, status: input.status })
        .where(eq(tasks.id, input.taskIds[i]));
    }
  });

  revalidatePath(`/clients/[slug]/boards/${input.boardId}`);
  return { success: true };
}

/**
 * Complete task and create next recurring instance if applicable
 */
export async function completeTask(taskId: string): Promise<{
  success: boolean;
  nextTask?: Task;
  error?: string;
}> {
  const user = await getCurrentUser();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      assignees: true,
    },
  });

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // Update status to complete
  await db.update(tasks)
    .set({ status: 'complete', updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Create next recurring instance if applicable
  if (task.recurringConfig) {
    const nextDueDate = calculateNextOccurrence(
      task.recurringConfig,
      task.dueDate ? new Date(task.dueDate) : new Date()
    );

    if (nextDueDate) {
      const [nextTask] = await db.insert(tasks).values({
        boardId: task.boardId,
        title: task.title,
        description: task.description,
        status: 'todo', // Reset to initial status
        section: task.section,
        dueDate: nextDueDate.toISOString().split('T')[0],
        dateFlexibility: task.dateFlexibility,
        recurringConfig: task.recurringConfig,
        recurringGroupId: task.recurringGroupId ?? task.id,
        position: 0,
        createdBy: user.id,
      }).returning();

      // Copy assignees
      if (task.assignees.length) {
        await db.insert(taskAssignees).values(
          task.assignees.map(a => ({
            taskId: nextTask.id,
            userId: a.userId,
          }))
        );
      }

      return { success: true, nextTask };
    }
  }

  return { success: true };
}

/**
 * Delete task
 */
export async function deleteTask(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  // Permission check
  // Delete (cascade handles assignees, comments, attachments)
}

/**
 * Delete all tasks in a recurring series
 */
export async function deleteRecurringSeries(recurringGroupId: string): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  // Delete all tasks with matching recurringGroupId
}
```

---

## Comment Actions

### `/lib/actions/comments.ts`

```typescript
'use server';

interface CreateCommentInput {
  taskId: string;
  content: TiptapContent;
}

interface UpdateCommentInput {
  id: string;
  content: TiptapContent;
}

/**
 * Get comments for a task
 */
export async function getCommentsForTask(taskId: string): Promise<CommentWithAuthor[]> {
  const user = await getCurrentUser();
  // Verify user has access to the task's board

  return db.query.comments.findMany({
    where: eq(comments.taskId, taskId),
    with: {
      author: {
        columns: { id: true, name: true, avatarUrl: true },
      },
      attachments: true,
    },
    orderBy: (comments, { asc }) => [asc(comments.createdAt)],
  });
}

/**
 * Create comment
 */
export async function createComment(input: CreateCommentInput): Promise<{
  success: boolean;
  comment?: Comment;
  error?: string;
}> {
  const user = await getCurrentUser();
  // Verify access to task's board

  const [comment] = await db.insert(comments).values({
    taskId: input.taskId,
    authorId: user.id,
    content: input.content,
  }).returning();

  // Extract mentions and trigger notifications
  const mentions = extractMentions(input.content);
  await triggerMentionNotifications(input.taskId, comment.id, mentions, user.id);

  // Notify task assignees of new comment (excluding author)
  await triggerCommentNotifications(input.taskId, comment.id, user.id);

  revalidatePath(`/clients/[slug]/boards/[boardId]`);
  return { success: true, comment };
}

/**
 * Update comment (author only)
 */
export async function updateComment(input: UpdateCommentInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, input.id),
  });

  if (!comment) {
    return { success: false, error: 'Comment not found' };
  }

  if (comment.authorId !== user.id && user.role !== 'admin') {
    return { success: false, error: 'Not authorized' };
  }

  await db.update(comments)
    .set({ content: input.content, updatedAt: new Date() })
    .where(eq(comments.id, input.id));

  return { success: true };
}

/**
 * Delete comment (author or admin only)
 */
export async function deleteComment(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  // Author or admin check
  // Delete comment (cascade deletes attachments)
}
```

---

## Notification Actions

### `/lib/actions/notifications.ts`

```typescript
'use server';

/**
 * Get notifications for current user
 */
export async function getMyNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> {
  const user = await getCurrentUser();

  const whereClause = options?.unreadOnly
    ? and(eq(notifications.userId, user.id), isNull(notifications.readAt))
    : eq(notifications.userId, user.id);

  const [notifs, countResult] = await Promise.all([
    db.query.notifications.findMany({
      where: whereClause,
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      with: {
        task: {
          columns: { id: true, title: true, boardId: true },
        },
      },
    }),
    db.select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);

  return {
    notifications: notifs,
    unreadCount: countResult[0]?.count ?? 0,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();

  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.id, id),
      eq(notifications.userId, user.id)
    ));

  return { success: true };
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const user = await getCurrentUser();

  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(notifications.userId, user.id),
      isNull(notifications.readAt)
    ));

  return { success: true };
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  preferences: NotificationPreferences
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();

  await db.update(users)
    .set({
      preferences: {
        ...user.preferences,
        notifications: preferences,
      },
    })
    .where(eq(users.id, user.id));

  return { success: true };
}
```

---

## Rollup Actions

### `/lib/actions/rollups.ts`

```typescript
'use server';

interface CreateRollupInput {
  name: string;
  sourceBoardIds: string[];
}

/**
 * Create custom rollup board
 */
export async function createRollupBoard(input: CreateRollupInput): Promise<{
  success: boolean;
  board?: Board;
  error?: string;
}> {
  const user = await getCurrentUser();

  // Verify user has access to all source boards
  for (const boardId of input.sourceBoardIds) {
    const permission = await getBoardPermission(user.id, boardId);
    if (!permission) {
      return { success: false, error: `No access to board ${boardId}` };
    }
  }

  // Create rollup board (no client, type=rollup)
  const [board] = await db.insert(boards).values({
    name: input.name,
    type: 'rollup',
    statusOptions: [], // Rollups use source board statuses
    createdBy: user.id,
  }).returning();

  // Add source board links
  await db.insert(rollupSources).values(
    input.sourceBoardIds.map(sourceBoardId => ({
      rollupBoardId: board.id,
      sourceBoardId,
    }))
  );

  // Grant access to creator
  await db.insert(boardAccess).values({
    boardId: board.id,
    userId: user.id,
    accessLevel: 'full',
  });

  return { success: true, board };
}

/**
 * Get tasks for rollup board
 */
export async function getRollupTasks(rollupBoardId: string): Promise<TaskWithBoardInfo[]> {
  const user = await getCurrentUser();

  // Get source boards
  const sources = await db.query.rollupSources.findMany({
    where: eq(rollupSources.rollupBoardId, rollupBoardId),
  });

  const sourceBoardIds = sources.map(s => s.sourceBoardId);

  // Get tasks from all source boards (with permission filtering)
  const allTasks: TaskWithBoardInfo[] = [];

  for (const boardId of sourceBoardIds) {
    const permission = await getBoardPermission(user.id, boardId);
    if (!permission) continue;

    let query = db.select()
      .from(tasks)
      .innerJoin(boards, eq(tasks.boardId, boards.id))
      .innerJoin(clients, eq(boards.clientId, clients.id))
      .where(eq(tasks.boardId, boardId));

    if (permission.viewScope === 'assigned_only') {
      query = query.innerJoin(
        taskAssignees,
        and(
          eq(tasks.id, taskAssignees.taskId),
          eq(taskAssignees.userId, user.id)
        )
      );
    }

    const boardTasks = await query;
    allTasks.push(...boardTasks);
  }

  return allTasks.sort((a, b) => {
    // Sort by client name, then status, then position
    if (a.client.name !== b.client.name) {
      return a.client.name.localeCompare(b.client.name);
    }
    if (a.task.status !== b.task.status) {
      return a.task.status.localeCompare(b.task.status);
    }
    return a.task.position - b.task.position;
  });
}

/**
 * Update rollup source boards
 */
export async function updateRollupSources(
  rollupBoardId: string,
  sourceBoardIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();

  // Verify ownership of rollup board
  const board = await db.query.boards.findFirst({
    where: and(
      eq(boards.id, rollupBoardId),
      eq(boards.type, 'rollup'),
      eq(boards.createdBy, user.id)
    ),
  });

  if (!board) {
    return { success: false, error: 'Rollup board not found or not owned by you' };
  }

  // Verify access to all new source boards
  // Replace sources
  await db.transaction(async (tx) => {
    await tx.delete(rollupSources)
      .where(eq(rollupSources.rollupBoardId, rollupBoardId));

    await tx.insert(rollupSources).values(
      sourceBoardIds.map(sourceBoardId => ({
        rollupBoardId,
        sourceBoardId,
      }))
    );
  });

  return { success: true };
}
```

---

## API Routes (Webhooks & External)

### `/app/api/auth/[...nextauth]/route.ts`

Standard Auth.js route handler.

### `/app/api/uploadthing/route.ts`

```typescript
import { createRouteHandler } from 'uploadthing/next';
import { ourFileRouter } from '@/lib/uploadthing';

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
```

### `/app/api/webhooks/slack/route.ts`

```typescript
import { NextResponse } from 'next/server';

// Slack webhook for slash commands (optional future feature)
export async function POST(request: Request) {
  // Verify Slack signature
  // Handle slash commands
}
```

### `/app/api/inngest/route.ts`

```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sendMentionEmail, sendDailyDigest, createRecurringTask } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendMentionEmail,
    sendDailyDigest,
    createRecurringTask,
  ],
});
```

---

## Error Handling

All server actions follow this pattern:

```typescript
export async function someAction(input: Input): Promise<{
  success: boolean;
  data?: OutputData;
  error?: string;
}> {
  try {
    // Validate input
    const validated = schema.parse(input);

    // Check permissions
    const user = await getCurrentUser();
    if (!hasPermission(user, 'action')) {
      return { success: false, error: 'Access denied' };
    }

    // Perform action
    const result = await db...

    // Revalidate affected paths
    revalidatePath('/affected/path');

    return { success: true, data: result };
  } catch (error) {
    console.error('Action failed:', error);

    if (error instanceof ZodError) {
      return { success: false, error: 'Invalid input' };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

---

## Rate Limiting

For actions that could be abused, implement rate limiting:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
});

export async function rateLimitedAction(input: Input) {
  const user = await getCurrentUser();
  const { success } = await ratelimit.limit(user.id);

  if (!success) {
    return { success: false, error: 'Too many requests' };
  }

  // Continue with action...
}
```
