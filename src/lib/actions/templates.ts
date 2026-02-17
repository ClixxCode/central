'use server';

import { db } from '@/lib/db';
import {
  boardTemplates,
  templateTasks,
  boards,
  boardAccess,
  tasks,
  taskAssignees,
  teamMembers,
  users,
  clients,
  statuses,
  sections,
} from '@/lib/db/schema';
import type { StatusOption, SectionOption, TiptapContent, RecurringConfig } from '@/lib/db/schema';
import { eq, and, or, inArray, asc, desc, sql, isNull } from 'drizzle-orm';
import { getCurrentUser, requireAuth, requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import {
  createTemplateSchema,
  createTaskListSchema,
  updateTemplateSchema,
  addTemplateTaskSchema,
  updateTemplateTaskSchema,
  createBoardFromTemplateSchema,
  applyTemplateTasksSchema,
  createTemplateFromBoardSchema,
  type CreateTemplateInput,
  type CreateTaskListInput,
  type UpdateTemplateInput,
  type AddTemplateTaskInput,
  type UpdateTemplateTaskInput,
  type CreateBoardFromTemplateInput,
  type ApplyTemplateTasksInput,
  type CreateTemplateFromBoardInput,
  type UpdateTemplateTaskPositionInput,
} from '@/lib/validations/template';

// Types
export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  type: 'board_template' | 'task_list';
  icon: string | null;
  color: string | null;
  statusCount: number;
  sectionCount: number;
  taskCount: number;
  createdBy: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: Date;
}

export interface TemplateTaskWithSubtasks {
  id: string;
  templateId: string;
  title: string;
  description: TiptapContent | null;
  status: string | null;
  section: string | null;
  relativeDueDays: number | null;
  recurringConfig: RecurringConfig | null;
  position: number;
  parentTemplateTaskId: string | null;
  subtasks: TemplateTaskWithSubtasks[];
}

export interface TemplateDetail {
  id: string;
  name: string;
  description: string | null;
  type: 'board_template' | 'task_list';
  icon: string | null;
  color: string | null;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  createdBy: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: TemplateTaskWithSubtasks[];
}

interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * List all templates with optional type filter
 */
export async function listTemplates(
  type?: 'board_template' | 'task_list'
): Promise<ActionResult<TemplateSummary[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const conditions = type ? [eq(boardTemplates.type, type)] : [];

    const allTemplates = await db.query.boardTemplates.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        createdByUser: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(boardTemplates.createdAt)],
    });

    // Batch query task counts
    const templateIds = allTemplates.map((t) => t.id);
    let taskCounts: Record<string, number> = {};
    if (templateIds.length > 0) {
      const counts = await db
        .select({
          templateId: templateTasks.templateId,
          count: sql<number>`count(*)::int`,
        })
        .from(templateTasks)
        .where(inArray(templateTasks.templateId, templateIds))
        .groupBy(templateTasks.templateId);

      taskCounts = Object.fromEntries(counts.map((c) => [c.templateId, c.count]));
    }

    return {
      success: true,
      data: allTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type as 'board_template' | 'task_list',
        icon: t.icon,
        color: t.color,
        statusCount: (t.statusOptions as StatusOption[]).length,
        sectionCount: (t.sectionOptions as SectionOption[]).length,
        taskCount: taskCounts[t.id] ?? 0,
        createdBy: t.createdByUser
          ? {
              id: t.createdByUser.id,
              name: t.createdByUser.name,
              avatarUrl: t.createdByUser.avatarUrl,
            }
          : null,
        createdAt: t.createdAt,
      })),
    };
  } catch (error) {
    console.error('listTemplates error:', error);
    return { success: false, error: 'Failed to list templates' };
  }
}

/**
 * Get a single template with all its tasks
 */
export async function getTemplate(id: string): Promise<ActionResult<TemplateDetail>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, id),
      with: {
        createdByUser: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!template) return { success: false, error: 'Template not found' };

    // Fetch all tasks for this template
    const allTasks = await db.query.templateTasks.findMany({
      where: eq(templateTasks.templateId, id),
      orderBy: [asc(templateTasks.position)],
    });

    // Build tree: top-level tasks with nested subtasks
    const topLevelTasks = allTasks.filter((t) => !t.parentTemplateTaskId);
    const subtasksByParent = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (task.parentTemplateTaskId) {
        const existing = subtasksByParent.get(task.parentTemplateTaskId) ?? [];
        existing.push(task);
        subtasksByParent.set(task.parentTemplateTaskId, existing);
      }
    }

    const taskTree: TemplateTaskWithSubtasks[] = topLevelTasks.map((t) => ({
      id: t.id,
      templateId: t.templateId,
      title: t.title,
      description: t.description as TiptapContent | null,
      status: t.status,
      section: t.section,
      relativeDueDays: t.relativeDueDays,
      recurringConfig: (t.recurringConfig as RecurringConfig) ?? null,
      position: t.position,
      parentTemplateTaskId: t.parentTemplateTaskId,
      subtasks: (subtasksByParent.get(t.id) ?? []).map((st) => ({
        id: st.id,
        templateId: st.templateId,
        title: st.title,
        description: st.description as TiptapContent | null,
        status: st.status,
        section: st.section,
        relativeDueDays: st.relativeDueDays,
        recurringConfig: (st.recurringConfig as RecurringConfig) ?? null,
        position: st.position,
        parentTemplateTaskId: st.parentTemplateTaskId,
        subtasks: [],
      })),
    }));

    return {
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type as 'board_template' | 'task_list',
        icon: template.icon,
        color: template.color,
        statusOptions: template.statusOptions as StatusOption[],
        sectionOptions: template.sectionOptions as SectionOption[],
        createdBy: template.createdByUser
          ? {
              id: template.createdByUser.id,
              name: template.createdByUser.name,
              avatarUrl: template.createdByUser.avatarUrl,
            }
          : null,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        tasks: taskTree,
      },
    };
  } catch (error) {
    console.error('getTemplate error:', error);
    return { success: false, error: 'Failed to get template' };
  }
}

/**
 * Create a board template (with statuses/sections)
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth();

    const validation = createTemplateSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { name, description, statusOptions, sectionOptions } = validation.data;

    // If no status options provided, fetch from global statuses
    let templateStatusOptions: StatusOption[] | undefined = statusOptions;
    if (!templateStatusOptions) {
      const globalStatuses = await db.query.statuses.findMany({
        orderBy: [asc(statuses.position)],
      });
      if (globalStatuses.length > 0) {
        templateStatusOptions = globalStatuses.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }));
      }
    }

    // If no section options provided, fetch from global sections
    let templateSectionOptions: SectionOption[] | undefined = sectionOptions;
    if (!templateSectionOptions) {
      const globalSections = await db.query.sections.findMany({
        orderBy: [asc(sections.position)],
      });
      if (globalSections.length > 0) {
        templateSectionOptions = globalSections.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }));
      }
    }

    const [newTemplate] = await db
      .insert(boardTemplates)
      .values({
        name,
        description: description ?? null,
        type: 'board_template',
        statusOptions: templateStatusOptions ?? [],
        sectionOptions: templateSectionOptions ?? [],
        createdBy: user.id,
      })
      .returning();

    revalidatePath('/templates');

    return { success: true, data: { id: newTemplate.id } };
  } catch (error) {
    console.error('createTemplate error:', error);
    return { success: false, error: 'Failed to create template' };
  }
}

/**
 * Create a task list (just name + description, no statuses/sections)
 */
export async function createTaskList(
  input: CreateTaskListInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth();

    const validation = createTaskListSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { name, description } = validation.data;

    const [newTemplate] = await db
      .insert(boardTemplates)
      .values({
        name,
        description: description ?? null,
        type: 'task_list',
        statusOptions: [],
        sectionOptions: [],
        createdBy: user.id,
      })
      .returning();

    revalidatePath('/templates');

    return { success: true, data: { id: newTemplate.id } };
  } catch (error) {
    console.error('createTaskList error:', error);
    return { success: false, error: 'Failed to create task list' };
  }
}

/**
 * Create a template from an existing board
 */
export async function createTemplateFromBoard(
  input: CreateTemplateFromBoardInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth();

    const validation = createTemplateFromBoardSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { boardId, name, description, includeTasks } = validation.data;

    // Verify board access
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
    });
    if (!board) return { success: false, error: 'Board not found' };

    // Create template with board's config
    const [newTemplate] = await db
      .insert(boardTemplates)
      .values({
        name,
        description: description ?? null,
        type: 'board_template',
        icon: board.icon,
        color: board.color,
        statusOptions: board.statusOptions,
        sectionOptions: board.sectionOptions ?? [],
        createdBy: user.id,
      })
      .returning();

    // If including tasks, snapshot all non-archived tasks
    if (includeTasks) {
      const boardTasks = await db.query.tasks.findMany({
        where: and(
          eq(tasks.boardId, boardId),
          isNull(tasks.archivedAt)
        ),
        orderBy: [asc(tasks.position)],
      });

      if (boardTasks.length > 200) {
        // Still create template but warn about cap
        return { success: false, error: 'Board has more than 200 tasks. Template was created without tasks.' };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build parent task ID mapping (board task ID -> template task ID)
      const taskIdMapping = new Map<string, string>();

      // First pass: insert top-level tasks
      const topLevelTasks = boardTasks.filter((t) => !t.parentTaskId);
      if (topLevelTasks.length > 0) {
        const insertedTopLevel = await db
          .insert(templateTasks)
          .values(
            topLevelTasks.map((t) => ({
              templateId: newTemplate.id,
              title: t.title,
              description: t.description,
              status: t.status,
              section: t.section,
              relativeDueDays: t.dueDate
                ? Math.round(
                    (new Date(t.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  )
                : null,
              position: t.position,
            }))
          )
          .returning();

        // Map board task IDs to template task IDs
        topLevelTasks.forEach((t, i) => {
          taskIdMapping.set(t.id, insertedTopLevel[i].id);
        });
      }

      // Second pass: insert subtasks
      const subtasks = boardTasks.filter((t) => t.parentTaskId);
      if (subtasks.length > 0) {
        await db.insert(templateTasks).values(
          subtasks
            .filter((t) => taskIdMapping.has(t.parentTaskId!))
            .map((t) => ({
              templateId: newTemplate.id,
              title: t.title,
              description: t.description,
              status: t.status,
              section: t.section,
              relativeDueDays: t.dueDate
                ? Math.round(
                    (new Date(t.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  )
                : null,
              position: t.position,
              parentTemplateTaskId: taskIdMapping.get(t.parentTaskId!),
            }))
        );
      }
    }

    revalidatePath('/templates');

    return { success: true, data: { id: newTemplate.id } };
  } catch (error) {
    console.error('createTemplateFromBoard error:', error);
    return { success: false, error: 'Failed to create template from board' };
  }
}

/**
 * Update a template (name, description, statuses, sections)
 */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, id),
      columns: { id: true, createdBy: true },
    });
    if (!template) return { success: false, error: 'Template not found' };

    // Only creator or admin can edit
    if (template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    const validation = updateTemplateSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const updateData: Partial<typeof boardTemplates.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description;
    if (validation.data.statusOptions !== undefined) updateData.statusOptions = validation.data.statusOptions;
    if (validation.data.sectionOptions !== undefined) updateData.sectionOptions = validation.data.sectionOptions;
    if (validation.data.icon !== undefined) updateData.icon = validation.data.icon;
    if (validation.data.color !== undefined) updateData.color = validation.data.color;

    await db.update(boardTemplates).set(updateData).where(eq(boardTemplates.id, id));

    revalidatePath('/templates');

    return { success: true };
  } catch (error) {
    console.error('updateTemplate error:', error);
    return { success: false, error: 'Failed to update template' };
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, id),
      columns: { id: true, createdBy: true },
    });
    if (!template) return { success: false, error: 'Template not found' };

    if (template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    await db.delete(boardTemplates).where(eq(boardTemplates.id, id));

    revalidatePath('/templates');

    return { success: true };
  } catch (error) {
    console.error('deleteTemplate error:', error);
    return { success: false, error: 'Failed to delete template' };
  }
}

/**
 * Add a task to a template
 */
export async function addTemplateTask(
  input: AddTemplateTaskInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth();

    const validation = addTemplateTaskSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { templateId, title, descriptionJson, status, section, relativeDueDays, recurringConfigJson, parentTemplateTaskId } =
      validation.data;

    // Verify template access
    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, templateId),
      columns: { id: true, createdBy: true },
    });
    if (!template) return { success: false, error: 'Template not found' };
    if (template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    // If adding a subtask, validate parent exists and is not a subtask itself
    if (parentTemplateTaskId) {
      const parentTask = await db.query.templateTasks.findFirst({
        where: eq(templateTasks.id, parentTemplateTaskId),
        columns: { id: true, parentTemplateTaskId: true },
      });
      if (!parentTask) return { success: false, error: 'Parent task not found' };
      if (parentTask.parentTemplateTaskId) {
        return { success: false, error: 'Cannot create subtasks of subtasks' };
      }
    }

    // Get max position scoped to siblings
    const maxPositionResult = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${templateTasks.position}), -1)` })
      .from(templateTasks)
      .where(
        parentTemplateTaskId
          ? eq(templateTasks.parentTemplateTaskId, parentTemplateTaskId)
          : and(eq(templateTasks.templateId, templateId), isNull(templateTasks.parentTemplateTaskId))
      );

    const position = (maxPositionResult[0]?.maxPos ?? -1) + 1;

    const description = descriptionJson ? JSON.parse(descriptionJson) : null;
    const recurringConfig = recurringConfigJson ? JSON.parse(recurringConfigJson) : null;

    const [newTask] = await db
      .insert(templateTasks)
      .values({
        templateId,
        title,
        description,
        status: status ?? null,
        section: section ?? null,
        relativeDueDays: relativeDueDays ?? null,
        recurringConfig,
        position,
        parentTemplateTaskId: parentTemplateTaskId ?? null,
      })
      .returning();

    return { success: true, data: { id: newTask.id } };
  } catch (error) {
    console.error('addTemplateTask error:', error);
    return { success: false, error: 'Failed to add template task' };
  }
}

/**
 * Update a template task
 */
export async function updateTemplateTask(
  taskId: string,
  input: UpdateTemplateTaskInput
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    // Get task and its template
    const task = await db.query.templateTasks.findFirst({
      where: eq(templateTasks.id, taskId),
      with: {
        template: {
          columns: { id: true, createdBy: true },
        },
      },
    });
    if (!task) return { success: false, error: 'Template task not found' };
    if (task.template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    const validation = updateTemplateTaskSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const updateData: Partial<typeof templateTasks.$inferInsert> = {};
    if (validation.data.title !== undefined) updateData.title = validation.data.title;
    if (validation.data.descriptionJson !== undefined) {
      updateData.description = validation.data.descriptionJson
        ? JSON.parse(validation.data.descriptionJson)
        : null;
    }
    if (validation.data.status !== undefined) updateData.status = validation.data.status;
    if (validation.data.section !== undefined) updateData.section = validation.data.section;
    if (validation.data.relativeDueDays !== undefined)
      updateData.relativeDueDays = validation.data.relativeDueDays;
    if (validation.data.recurringConfigJson !== undefined) {
      updateData.recurringConfig = validation.data.recurringConfigJson
        ? JSON.parse(validation.data.recurringConfigJson)
        : null;
    }
    if (validation.data.position !== undefined) updateData.position = validation.data.position;

    await db.update(templateTasks).set(updateData).where(eq(templateTasks.id, taskId));

    return { success: true };
  } catch (error) {
    console.error('updateTemplateTask error:', error);
    return { success: false, error: 'Failed to update template task' };
  }
}

/**
 * Delete a template task
 */
export async function deleteTemplateTask(taskId: string): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const task = await db.query.templateTasks.findFirst({
      where: eq(templateTasks.id, taskId),
      with: {
        template: {
          columns: { id: true, createdBy: true },
        },
      },
    });
    if (!task) return { success: false, error: 'Template task not found' };
    if (task.template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    await db.delete(templateTasks).where(eq(templateTasks.id, taskId));

    return { success: true };
  } catch (error) {
    console.error('deleteTemplateTask error:', error);
    return { success: false, error: 'Failed to delete template task' };
  }
}

/**
 * Create a board from a board template (admin only)
 */
export async function createBoardFromTemplate(
  input: CreateBoardFromTemplateInput
): Promise<ActionResult<{ boardId: string; clientSlug: string }>> {
  try {
    const user = await requireAdmin();

    const validation = createBoardFromTemplateSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { templateId, clientId, boardName } = validation.data;

    // Verify template exists and is a board template
    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, templateId),
    });
    if (!template) return { success: false, error: 'Template not found' };
    if (template.type !== 'board_template') {
      return { success: false, error: 'Only board templates can create new boards' };
    }

    // Verify client exists
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true, slug: true },
    });
    if (!client) return { success: false, error: 'Client not found' };

    // Create board with template config
    const [newBoard] = await db
      .insert(boards)
      .values({
        clientId,
        name: boardName,
        type: 'standard',
        statusOptions: template.statusOptions as StatusOption[],
        sectionOptions: template.sectionOptions as SectionOption[],
        icon: template.icon,
        color: template.color,
        createdBy: user.id,
      })
      .returning();

    // Get template tasks
    const allTemplateTasks = await db.query.templateTasks.findMany({
      where: eq(templateTasks.templateId, templateId),
      orderBy: [asc(templateTasks.position)],
    });

    if (allTemplateTasks.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const templateTaskIdMapping = new Map<string, string>();

      // Insert top-level tasks
      const topLevel = allTemplateTasks.filter((t) => !t.parentTemplateTaskId);
      if (topLevel.length > 0) {
        const statusOptions = template.statusOptions as StatusOption[];
        const defaultStatus = statusOptions[0]?.id ?? 'todo';

        const insertedTasks = await db
          .insert(tasks)
          .values(
            topLevel.map((t) => ({
              boardId: newBoard.id,
              title: t.title,
              description: t.description as TiptapContent | undefined,
              status: t.status ?? defaultStatus,
              section: t.section,
              dueDate: t.relativeDueDays != null
                ? new Date(today.getTime() + t.relativeDueDays * 86400000)
                    .toISOString()
                    .split('T')[0]
                : undefined,
              recurringConfig: t.recurringConfig as RecurringConfig | undefined,
              position: t.position,
              createdBy: user.id,
            }))
          )
          .returning();

        topLevel.forEach((t, i) => {
          templateTaskIdMapping.set(t.id, insertedTasks[i].id);
        });
      }

      // Insert subtasks
      const subs = allTemplateTasks.filter((t) => t.parentTemplateTaskId);
      if (subs.length > 0) {
        const statusOptions = template.statusOptions as StatusOption[];
        const defaultStatus = statusOptions[0]?.id ?? 'todo';

        await db.insert(tasks).values(
          subs
            .filter((t) => templateTaskIdMapping.has(t.parentTemplateTaskId!))
            .map((t) => ({
              boardId: newBoard.id,
              title: t.title,
              description: t.description as TiptapContent | undefined,
              status: t.status ?? defaultStatus,
              section: t.section,
              dueDate: t.relativeDueDays != null
                ? new Date(today.getTime() + t.relativeDueDays * 86400000)
                    .toISOString()
                    .split('T')[0]
                : undefined,
              position: t.position,
              parentTaskId: templateTaskIdMapping.get(t.parentTemplateTaskId!),
              createdBy: user.id,
            }))
        );
      }
    }

    revalidatePath(`/clients/${client.slug}`);
    revalidatePath('/', 'layout');

    return { success: true, data: { boardId: newBoard.id, clientSlug: client.slug } };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('createBoardFromTemplate error:', error);
    return { success: false, error: 'Failed to create board from template' };
  }
}

/**
 * Batch update template task positions (and optionally status) for DnD reordering
 */
export async function updateTemplateTaskPositions(
  templateId: string,
  updates: { id: string; position: number; status?: string }[]
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, templateId),
      columns: { id: true, createdBy: true },
    });
    if (!template) return { success: false, error: 'Template not found' };
    if (template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    if (updates.length === 0) return { success: true };

    await db.transaction(async (tx) => {
      for (const update of updates) {
        const data: Partial<typeof templateTasks.$inferInsert> = {
          position: update.position,
        };
        if (update.status !== undefined) data.status = update.status;
        await tx.update(templateTasks).set(data).where(eq(templateTasks.id, update.id));
      }
    });

    return { success: true };
  } catch (error) {
    console.error('updateTemplateTaskPositions error:', error);
    return { success: false, error: 'Failed to update task positions' };
  }
}

/**
 * Bulk update template tasks (section and/or relativeDueDays)
 */
export async function bulkUpdateTemplateTasks(
  templateId: string,
  input: { taskIds: string[]; section?: string | null; relativeDueDays?: number | null }
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    if (input.taskIds.length === 0) return { success: true };

    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, templateId),
      columns: { id: true, createdBy: true },
    });
    if (!template) return { success: false, error: 'Template not found' };
    if (template.createdBy !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Permission denied' };
    }

    // Verify all taskIds belong to this template
    const matchingTasks = await db
      .select({ id: templateTasks.id })
      .from(templateTasks)
      .where(
        and(
          inArray(templateTasks.id, input.taskIds),
          eq(templateTasks.templateId, templateId)
        )
      );

    if (matchingTasks.length !== input.taskIds.length) {
      return { success: false, error: 'Some tasks do not belong to this template' };
    }

    const updateData: Partial<typeof templateTasks.$inferInsert> = {};
    if (input.section !== undefined) updateData.section = input.section;
    if (input.relativeDueDays !== undefined) updateData.relativeDueDays = input.relativeDueDays;

    if (Object.keys(updateData).length === 0) return { success: true };

    await db
      .update(templateTasks)
      .set(updateData)
      .where(inArray(templateTasks.id, input.taskIds));

    return { success: true };
  } catch (error) {
    console.error('bulkUpdateTemplateTasks error:', error);
    return { success: false, error: 'Failed to bulk update template tasks' };
  }
}

/**
 * Apply template tasks to an existing board
 */
export async function applyTemplateTasksToBoard(
  input: ApplyTemplateTasksInput
): Promise<ActionResult<{ taskCount: number }>> {
  try {
    const user = await requireAuth();
    const isAdmin = user.role === 'admin';

    const validation = applyTemplateTasksSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { templateId, boardId, statusMapping, sectionMapping } = validation.data;

    // Verify template
    const template = await db.query.boardTemplates.findFirst({
      where: eq(boardTemplates.id, templateId),
    });
    if (!template) return { success: false, error: 'Template not found' };

    // Verify board access
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
    });
    if (!board) return { success: false, error: 'Board not found' };

    // Get template tasks
    const allTemplateTasks = await db.query.templateTasks.findMany({
      where: eq(templateTasks.templateId, templateId),
      orderBy: [asc(templateTasks.position)],
    });

    if (allTemplateTasks.length === 0) {
      return { success: true, data: { taskCount: 0 } };
    }

    const boardStatusOptions = board.statusOptions as StatusOption[];
    const defaultStatus = boardStatusOptions[0]?.id ?? 'todo';

    // Get max position on the board
    const maxPosResult = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), isNull(tasks.parentTaskId)));
    let nextPosition = (maxPosResult[0]?.maxPos ?? -1) + 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isTaskList = template.type === 'task_list';

    // Resolve status for a template task
    const resolveStatus = (templateStatus: string | null): string => {
      if (isTaskList || !templateStatus) return defaultStatus;
      return statusMapping?.[templateStatus] ?? defaultStatus;
    };

    // Resolve section for a template task
    const resolveSection = (templateSection: string | null): string | null => {
      if (isTaskList || !templateSection) return null;
      if (!sectionMapping) return null;
      return sectionMapping[templateSection] ?? null;
    };

    const templateTaskIdMapping = new Map<string, string>();

    // Insert top-level tasks
    const topLevel = allTemplateTasks.filter((t) => !t.parentTemplateTaskId);
    if (topLevel.length > 0) {
      const insertedTasks = await db
        .insert(tasks)
        .values(
          topLevel.map((t, i) => ({
            boardId,
            title: t.title,
            description: t.description as TiptapContent | undefined,
            status: resolveStatus(t.status),
            section: resolveSection(t.section),
            dueDate: t.relativeDueDays != null
              ? new Date(today.getTime() + t.relativeDueDays * 86400000)
                  .toISOString()
                  .split('T')[0]
              : undefined,
            recurringConfig: t.recurringConfig as RecurringConfig | undefined,
            position: nextPosition + i,
            createdBy: user.id,
          }))
        )
        .returning();

      topLevel.forEach((t, i) => {
        templateTaskIdMapping.set(t.id, insertedTasks[i].id);
      });
    }

    // Insert subtasks
    const subs = allTemplateTasks.filter((t) => t.parentTemplateTaskId);
    if (subs.length > 0) {
      await db.insert(tasks).values(
        subs
          .filter((t) => templateTaskIdMapping.has(t.parentTemplateTaskId!))
          .map((t) => ({
            boardId,
            title: t.title,
            description: t.description as TiptapContent | undefined,
            status: resolveStatus(t.status),
            section: resolveSection(t.section),
            dueDate: t.relativeDueDays != null
              ? new Date(today.getTime() + t.relativeDueDays * 86400000)
                  .toISOString()
                  .split('T')[0]
              : undefined,
            position: t.position,
            parentTaskId: templateTaskIdMapping.get(t.parentTemplateTaskId!),
            createdBy: user.id,
          }))
      );
    }

    revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

    return { success: true, data: { taskCount: allTemplateTasks.length } };
  } catch (error) {
    console.error('applyTemplateTasksToBoard error:', error);
    return { success: false, error: 'Failed to apply template tasks' };
  }
}
