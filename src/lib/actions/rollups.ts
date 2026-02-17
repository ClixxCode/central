'use server';

import { db } from '@/lib/db';
import {
  boards,
  rollupSources,
  rollupOwners,
  rollupInvitations,
  boardAccess,
  teamMembers,
  teams,
  tasks,
  taskAssignees,
  users,
  comments,
  attachments,
  taskViews,
} from '@/lib/db/schema';
import type { StatusOption, SectionOption, TiptapContent, RecurringConfig } from '@/lib/db/schema';
import { eq, and, or, inArray, notInArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { getCurrentUser, requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import {
  createRollupBoardSchema,
  updateRollupSourcesSchema,
  updateRollupBoardSchema,
  type CreateRollupBoardInput,
  type UpdateRollupSourcesInput,
  type UpdateRollupBoardInput,
} from '@/lib/validations/rollup';
import type { TaskFilters, TaskSortOptions } from './tasks';
import { getSiteSettings } from './site-settings';
import { getOrgToday } from '@/lib/utils/timezone';

// Types
export interface RollupBoardSummary {
  id: string;
  name: string;
  type: 'rollup';
  sourceCount: number;
}

export interface RollupBoardWithSources {
  id: string;
  name: string;
  type: 'rollup';
  reviewModeEnabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  sources: {
    boardId: string;
    boardName: string;
    clientId: string | null;
    clientName: string | null;
    clientSlug: string | null;
    clientColor: string | null;
    clientIcon: string | null;
  }[];
}

export interface RollupTaskWithAssignees {
  id: string;
  boardId: string;
  boardName: string;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  clientColor: string | null;
  clientIcon: string | null;
  title: string;
  description: TiptapContent | null;
  status: string;
  section: string | null;
  dueDate: string | null;
  dateFlexibility: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  recurringConfig: RecurringConfig | null;
  recurringGroupId: string | null;
  position: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignees: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    deactivatedAt: Date | null;
  }[];
  commentCount: number;
  attachmentCount: number;
  hasNewComments: boolean;
  parentTaskId: string | null;
  subtaskCount: number;
  subtaskCompletedCount: number;
  archivedAt: Date | null;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Check if user is in a contractor team (excludeFromPublic = true)
 * Contractor teams need explicit board_access entries to see boards
 */
async function isUserInContractorTeam(userId: string): Promise<boolean> {
  const userTeamsWithDetails = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: {
        columns: { excludeFromPublic: true },
      },
    },
  });

  return userTeamsWithDetails.some((tm) => tm.team.excludeFromPublic);
}

// Helper: Get board IDs user has explicit access to (for contractors)
async function getExplicitAccessBoardIds(userId: string): Promise<string[]> {
  // Get user's team IDs
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  const teamIds = userTeams.map((t) => t.teamId);

  // Build the where clause for board access
  const conditions = [eq(boardAccess.userId, userId)];
  if (teamIds.length > 0) {
    conditions.push(inArray(boardAccess.teamId, teamIds));
  }

  // Get boards with direct access or via teams
  const accessEntries = await db.query.boardAccess.findMany({
    where: or(...conditions),
    columns: { boardId: true },
  });

  return [...new Set(accessEntries.map((a) => a.boardId))];
}

// Helper: Get user's access level for a board
type AccessLevel = 'full' | 'assigned_only' | null;

/**
 * Get user's access level for a board
 * Boards are PUBLIC by default - non-contractors get 'full' access
 * Contractors need explicit board_access entries
 */
async function getBoardAccessLevel(
  userId: string,
  boardId: string,
  isAdmin: boolean
): Promise<AccessLevel> {
  if (isAdmin) {
    return 'full';
  }

  // Check if user is in a contractor team
  const isContractor = await isUserInContractorTeam(userId);

  // Non-contractors have full access to all boards (public by default)
  if (!isContractor) {
    return 'full';
  }

  // Contractors need explicit access entries
  // Check direct user access
  const directAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      eq(boardAccess.userId, userId)
    ),
  });

  if (directAccess) {
    return directAccess.accessLevel;
  }

  // Check team access
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  if (userTeams.length === 0) {
    return null;
  }

  const teamIds = userTeams.map((t) => t.teamId);

  const teamAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      inArray(boardAccess.teamId, teamIds)
    ),
  });

  return teamAccess?.accessLevel ?? null;
}

/**
 * Get rollup IDs a non-contractor user has access to via ownership or invitations.
 * Rollups are private by default — users must be an owner or have an accepted invitation.
 */
async function getAccessibleRollupIds(userId: string): Promise<Set<string>> {
  // Get rollups user owns
  const ownedRollups = await db.query.rollupOwners.findMany({
    where: eq(rollupOwners.userId, userId),
    columns: { rollupBoardId: true },
  });

  // Get user's team IDs
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  const teamIds = userTeams.map((t) => t.teamId);

  // Build invitation conditions: direct user invite, team invite, or allUsers invite
  const inviteConditions = [
    eq(rollupInvitations.userId, userId),
    eq(rollupInvitations.allUsers, true),
  ];
  if (teamIds.length > 0) {
    inviteConditions.push(inArray(rollupInvitations.teamId, teamIds));
  }

  const acceptedInvitations = await db.query.rollupInvitations.findMany({
    where: and(
      eq(rollupInvitations.status, 'accepted'),
      or(...inviteConditions)
    ),
    columns: { rollupBoardId: true },
  });

  const ids = new Set<string>();
  for (const o of ownedRollups) ids.add(o.rollupBoardId);
  for (const i of acceptedInvitations) ids.add(i.rollupBoardId);
  return ids;
}

/**
 * List rollup boards the user has access to
 */
export async function listRollupBoards(): Promise<ActionResult<RollupBoardSummary[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get all rollup boards
    const allRollups = await db.query.boards.findMany({
      where: eq(boards.type, 'rollup'),
      with: {
        rollupSources: true,
      },
    });

    // Check if user is in a contractor team
    const isContractor = await isUserInContractorTeam(user.id);

    if (isContractor) {
      // Contractors: filter to only rollups where they have explicit access to ALL source boards
      const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);
      const accessibleSet = new Set(accessibleBoardIds);

      const accessibleRollups = allRollups.filter((rollup) =>
        rollup.rollupSources.every((source) =>
          accessibleSet.has(source.sourceBoardId)
        )
      );

      return {
        success: true,
        data: accessibleRollups.map((rollup) => ({
          id: rollup.id,
          name: rollup.name,
          type: 'rollup' as const,
          sourceCount: rollup.rollupSources.length,
        })),
      };
    }

    // All non-contractor users (including admins): rollups are private by default,
    // only visible via ownership or accepted invitations
    const accessibleIds = await getAccessibleRollupIds(user.id);
    const accessibleRollups = allRollups.filter((rollup) => accessibleIds.has(rollup.id));

    return {
      success: true,
      data: accessibleRollups.map((rollup) => ({
        id: rollup.id,
        name: rollup.name,
        type: 'rollup' as const,
        sourceCount: rollup.rollupSources.length,
      })),
    };
  } catch (error) {
    console.error('listRollupBoards error:', error);
    return { success: false, error: 'Failed to list rollup boards' };
  }
}

/**
 * Get a rollup board with its source boards
 */
export async function getRollupBoard(
  rollupBoardId: string
): Promise<ActionResult<RollupBoardWithSources | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get the rollup board
    const rollup = await db.query.boards.findFirst({
      where: and(eq(boards.id, rollupBoardId), eq(boards.type, 'rollup')),
      with: {
        rollupSources: {
          with: {
            sourceBoard: {
              with: {
                client: {
                  columns: { id: true, name: true, slug: true, color: true, icon: true },
                },
              },
            },
          },
        },
      },
    });

    if (!rollup) {
      return { success: true, data: null };
    }

    // Check user has access to this rollup
    const isContractor = await isUserInContractorTeam(user.id);

    if (isContractor) {
      // Contractors need explicit access to all source boards
      const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);
      const accessibleSet = new Set(accessibleBoardIds);

      const hasAccessToAll = rollup.rollupSources.every((source) =>
        accessibleSet.has(source.sourceBoardId)
      );

      if (!hasAccessToAll) {
        return { success: true, data: null };
      }
    } else {
      // All non-contractor users (including admins): check ownership + invitations
      const accessibleIds = await getAccessibleRollupIds(user.id);
      if (!accessibleIds.has(rollup.id)) {
        return { success: true, data: null };
      }
    }

    return {
      success: true,
      data: {
        id: rollup.id,
        name: rollup.name,
        type: 'rollup' as const,
        reviewModeEnabled: rollup.reviewModeEnabled,
        createdBy: rollup.createdBy,
        createdAt: rollup.createdAt,
        sources: rollup.rollupSources.map((source) => ({
          boardId: source.sourceBoard.id,
          boardName: source.sourceBoard.name,
          clientId: source.sourceBoard.client?.id ?? null,
          clientName: source.sourceBoard.client?.name ?? null,
          clientSlug: source.sourceBoard.client?.slug ?? null,
          clientColor: source.sourceBoard.client?.color ?? null,
          clientIcon: source.sourceBoard.client?.icon ?? null,
        })),
      },
    };
  } catch (error) {
    console.error('getRollupBoard error:', error);
    return { success: false, error: 'Failed to get rollup board' };
  }
}

/**
 * Create a new rollup board
 */
export async function createRollupBoard(
  input: CreateRollupBoardInput
): Promise<ActionResult<RollupBoardWithSources>> {
  try {
    const user = await requireAuth();

    // Validate input
    const validation = createRollupBoardSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message ?? 'Invalid input',
      };
    }

    const { name, sourceBoardIds } = validation.data;
    const userIsAdmin = user.role === 'admin';

    // Verify user has access to all source boards
    if (!userIsAdmin) {
      const isContractor = await isUserInContractorTeam(user.id);

      if (isContractor) {
        // Contractors need explicit access to all source boards
        const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);
        const accessibleSet = new Set(accessibleBoardIds);

        const allAccessible = sourceBoardIds.every((id) => accessibleSet.has(id));
        if (!allAccessible) {
          return {
            success: false,
            error: 'You do not have access to all selected source boards',
          };
        }
      }
      // Non-contractors have access to all boards (public by default)
    }

    // Verify all source boards exist and are standard boards
    const sourceBoards = await db.query.boards.findMany({
      where: and(
        inArray(boards.id, sourceBoardIds),
        eq(boards.type, 'standard')
      ),
      with: {
        client: {
          columns: { id: true, name: true, slug: true, color: true, icon: true },
        },
      },
    });

    if (sourceBoards.length !== sourceBoardIds.length) {
      return {
        success: false,
        error: 'One or more source boards not found or are not standard boards',
      };
    }

    // Create the rollup board
    const [newRollup] = await db
      .insert(boards)
      .values({
        name,
        type: 'rollup',
        clientId: null, // Rollup boards are not client-specific
        createdBy: user.id,
      })
      .returning();

    // Create rollup source entries
    await db.insert(rollupSources).values(
      sourceBoardIds.map((sourceBoardId) => ({
        rollupBoardId: newRollup.id,
        sourceBoardId,
      }))
    );

    // Create ownership entry for the creator
    await db.insert(rollupOwners).values({
      rollupBoardId: newRollup.id,
      userId: user.id,
      isPrimary: true,
    });

    revalidatePath('/rollups');
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: {
        id: newRollup.id,
        name: newRollup.name,
        type: 'rollup' as const,
        reviewModeEnabled: newRollup.reviewModeEnabled,
        createdBy: newRollup.createdBy,
        createdAt: newRollup.createdAt,
        sources: sourceBoards.map((board) => ({
          boardId: board.id,
          boardName: board.name,
          clientId: board.client?.id ?? null,
          clientName: board.client?.name ?? null,
          clientSlug: board.client?.slug ?? null,
          clientColor: board.client?.color ?? null,
          clientIcon: board.client?.icon ?? null,
        })),
      },
    };
  } catch (error) {
    console.error('createRollupBoard error:', error);
    return { success: false, error: 'Failed to create rollup board' };
  }
}

/**
 * Update rollup board name
 */
export async function updateRollupBoard(
  rollupBoardId: string,
  input: UpdateRollupBoardInput
): Promise<ActionResult<RollupBoardWithSources>> {
  try {
    const user = await requireAuth();

    // Validate input
    const validation = updateRollupBoardSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message ?? 'Invalid input',
      };
    }

    const userIsAdmin = user.role === 'admin';

    // Get existing rollup
    const existingRollup = await db.query.boards.findFirst({
      where: and(eq(boards.id, rollupBoardId), eq(boards.type, 'rollup')),
      with: {
        rollupSources: {
          with: {
            sourceBoard: {
              with: {
                client: {
                  columns: { id: true, name: true, slug: true, color: true, icon: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existingRollup) {
      return { success: false, error: 'Rollup board not found' };
    }

    // Check access (only creator or admin can update)
    if (!userIsAdmin && existingRollup.createdBy !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    // Update rollup
    const [updatedRollup] = await db
      .update(boards)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.reviewModeEnabled !== undefined && { reviewModeEnabled: input.reviewModeEnabled }),
      })
      .where(eq(boards.id, rollupBoardId))
      .returning();

    revalidatePath(`/rollups/${rollupBoardId}`);
    revalidatePath('/rollups');

    return {
      success: true,
      data: {
        id: updatedRollup.id,
        name: updatedRollup.name,
        type: 'rollup' as const,
        reviewModeEnabled: updatedRollup.reviewModeEnabled,
        createdBy: updatedRollup.createdBy,
        createdAt: updatedRollup.createdAt,
        sources: existingRollup.rollupSources.map((source) => ({
          boardId: source.sourceBoard.id,
          boardName: source.sourceBoard.name,
          clientId: source.sourceBoard.client?.id ?? null,
          clientName: source.sourceBoard.client?.name ?? null,
          clientSlug: source.sourceBoard.client?.slug ?? null,
          clientColor: source.sourceBoard.client?.color ?? null,
          clientIcon: source.sourceBoard.client?.icon ?? null,
        })),
      },
    };
  } catch (error) {
    console.error('updateRollupBoard error:', error);
    return { success: false, error: 'Failed to update rollup board' };
  }
}

/**
 * Update source boards for a rollup
 */
export async function updateRollupSources(
  input: UpdateRollupSourcesInput
): Promise<ActionResult<RollupBoardWithSources>> {
  try {
    const user = await requireAuth();

    // Validate input
    const validation = updateRollupSourcesSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message ?? 'Invalid input',
      };
    }

    const { rollupBoardId, sourceBoardIds } = validation.data;
    const userIsAdmin = user.role === 'admin';

    // Get existing rollup
    const existingRollup = await db.query.boards.findFirst({
      where: and(eq(boards.id, rollupBoardId), eq(boards.type, 'rollup')),
    });

    if (!existingRollup) {
      return { success: false, error: 'Rollup board not found' };
    }

    // Check access (only creator or admin can update)
    if (!userIsAdmin && existingRollup.createdBy !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    // Verify user has access to all new source boards
    if (!userIsAdmin) {
      const isContractor = await isUserInContractorTeam(user.id);

      if (isContractor) {
        // Contractors need explicit access to all source boards
        const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);
        const accessibleSet = new Set(accessibleBoardIds);

        const allAccessible = sourceBoardIds.every((id) => accessibleSet.has(id));
        if (!allAccessible) {
          return {
            success: false,
            error: 'You do not have access to all selected source boards',
          };
        }
      }
      // Non-contractors have access to all boards (public by default)
    }

    // Verify all source boards exist and are standard boards
    const sourceBoards = await db.query.boards.findMany({
      where: and(
        inArray(boards.id, sourceBoardIds),
        eq(boards.type, 'standard')
      ),
      with: {
        client: {
          columns: { id: true, name: true, slug: true, color: true, icon: true },
        },
      },
    });

    if (sourceBoards.length !== sourceBoardIds.length) {
      return {
        success: false,
        error: 'One or more source boards not found or are not standard boards',
      };
    }

    // Delete existing sources and add new ones
    await db.delete(rollupSources).where(eq(rollupSources.rollupBoardId, rollupBoardId));

    await db.insert(rollupSources).values(
      sourceBoardIds.map((sourceBoardId) => ({
        rollupBoardId,
        sourceBoardId,
      }))
    );

    revalidatePath(`/rollups/${rollupBoardId}`);
    revalidatePath('/rollups');

    return {
      success: true,
      data: {
        id: existingRollup.id,
        name: existingRollup.name,
        type: 'rollup' as const,
        reviewModeEnabled: existingRollup.reviewModeEnabled,
        createdBy: existingRollup.createdBy,
        createdAt: existingRollup.createdAt,
        sources: sourceBoards.map((board) => ({
          boardId: board.id,
          boardName: board.name,
          clientId: board.client?.id ?? null,
          clientName: board.client?.name ?? null,
          clientSlug: board.client?.slug ?? null,
          clientColor: board.client?.color ?? null,
          clientIcon: board.client?.icon ?? null,
        })),
      },
    };
  } catch (error) {
    console.error('updateRollupSources error:', error);
    return { success: false, error: 'Failed to update rollup sources' };
  }
}

/**
 * Delete a rollup board
 */
export async function deleteRollupBoard(
  rollupBoardId: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const userIsAdmin = user.role === 'admin';

    // Get existing rollup
    const existingRollup = await db.query.boards.findFirst({
      where: and(eq(boards.id, rollupBoardId), eq(boards.type, 'rollup')),
    });

    if (!existingRollup) {
      return { success: false, error: 'Rollup board not found' };
    }

    // Check access (only creator or admin can delete)
    if (!userIsAdmin && existingRollup.createdBy !== user.id) {
      return { success: false, error: 'Permission denied' };
    }

    // Delete rollup (cascades to rollup_sources)
    await db.delete(boards).where(eq(boards.id, rollupBoardId));

    revalidatePath('/rollups');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('deleteRollupBoard error:', error);
    return { success: false, error: 'Failed to delete rollup board' };
  }
}

/**
 * Get aggregated tasks from all source boards
 */
export async function getRollupTasks(
  rollupBoardId: string,
  filters?: TaskFilters,
  sort?: TaskSortOptions
): Promise<ActionResult<{
  tasks: RollupTaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
}>> {
  try {
    const user = await requireAuth();
    const userIsAdmin = user.role === 'admin';

    // Get the rollup board and its sources
    const rollup = await db.query.boards.findFirst({
      where: and(eq(boards.id, rollupBoardId), eq(boards.type, 'rollup')),
      with: {
        rollupSources: {
          with: {
            sourceBoard: {
              with: {
                client: {
                  columns: { id: true, name: true, slug: true, color: true, icon: true },
                },
              },
            },
          },
        },
      },
    });

    if (!rollup) {
      return { success: false, error: 'Rollup board not found' };
    }

    // Verify user has access to this rollup (private by default)
    const isContractor = await isUserInContractorTeam(user.id);
    if (!isContractor) {
      const accessibleIds = await getAccessibleRollupIds(user.id);
      if (!accessibleIds.has(rollup.id)) {
        return { success: false, error: 'You do not have access to this rollup' };
      }
    }

    // Verify access to all source boards
    const accessLevels = new Map<string, AccessLevel>();

    for (const source of rollup.rollupSources) {
      const level = await getBoardAccessLevel(
        user.id,
        source.sourceBoardId,
        userIsAdmin
      );
      if (!level) {
        return {
          success: false,
          error: 'You do not have access to all source boards',
        };
      }
      accessLevels.set(source.sourceBoardId, level);
    }

    if (rollup.rollupSources.length === 0) {
      return {
        success: true,
        data: {
          tasks: [],
          statusOptions: [],
          sectionOptions: [],
        },
      };
    }

    const sourceBoardIds = rollup.rollupSources.map((s) => s.sourceBoardId);

    // Build task query conditions — exclude subtasks from rollup views
    const conditions = [inArray(tasks.boardId, sourceBoardIds), isNull(tasks.parentTaskId)];

    // Apply filters
    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      if (filters.statusMode === 'is_not') {
        conditions.push(notInArray(tasks.status, statuses));
      } else {
        conditions.push(inArray(tasks.status, statuses));
      }
    }

    if (filters?.section) {
      const sections = Array.isArray(filters.section)
        ? filters.section
        : [filters.section];
      const hasNoSection = sections.includes('__none__');
      const actualSections = sections.filter((s) => s !== '__none__');
      const isNot = filters.sectionMode === 'is_not';

      if (isNot) {
        if (hasNoSection && actualSections.length > 0) {
          conditions.push(
            and(
              isNotNull(tasks.section),
              notInArray(tasks.section, actualSections)
            )!
          );
        } else if (hasNoSection) {
          conditions.push(isNotNull(tasks.section));
        } else {
          conditions.push(
            or(
              isNull(tasks.section),
              notInArray(tasks.section, actualSections)
            )!
          );
        }
      } else {
        if (hasNoSection && actualSections.length > 0) {
          conditions.push(
            or(
              isNull(tasks.section),
              inArray(tasks.section, actualSections)
            )!
          );
        } else if (hasNoSection) {
          conditions.push(isNull(tasks.section));
        } else {
          conditions.push(inArray(tasks.section, actualSections));
        }
      }
    }

    // Apply overdue filter
    if (filters?.overdue) {
      const { data: siteSettingsData } = await getSiteSettings();
      const todayStr = getOrgToday(siteSettingsData?.timezone);
      conditions.push(
        and(
          isNotNull(tasks.dueDate),
          lt(tasks.dueDate, todayStr)
        )!
      );
    }

    // For assigned_only access, we need to filter after fetching
    // Get all tasks from source boards
    const allTasks = await db.query.tasks.findMany({
      where: and(...conditions),
      orderBy: (tasks, { asc, desc }) => {
        const direction = sort?.direction === 'desc' ? desc : asc;
        switch (sort?.field) {
          case 'dueDate':
            return [direction(tasks.dueDate)];
          case 'createdAt':
            return [direction(tasks.createdAt)];
          case 'title':
            return [direction(tasks.title)];
          case 'status':
            return [direction(tasks.status)];
          default:
            return [direction(tasks.position)];
        }
      },
    });

    // Get task IDs
    const taskIds = allTasks.map((t) => t.id);

    // Get assignees for all tasks
    const assigneesData =
      taskIds.length > 0
        ? await db
            .select({
              taskId: taskAssignees.taskId,
              userId: taskAssignees.userId,
              email: users.email,
              name: users.name,
              avatarUrl: users.avatarUrl,
              deactivatedAt: users.deactivatedAt,
            })
            .from(taskAssignees)
            .innerJoin(users, eq(users.id, taskAssignees.userId))
            .where(inArray(taskAssignees.taskId, taskIds))
        : [];

    // Group assignees by task
    const assigneesByTask = new Map<
      string,
      { id: string; email: string; name: string | null; avatarUrl: string | null; deactivatedAt: Date | null }[]
    >();

    for (const a of assigneesData) {
      if (!assigneesByTask.has(a.taskId)) {
        assigneesByTask.set(a.taskId, []);
      }
      assigneesByTask.get(a.taskId)!.push({
        id: a.userId,
        email: a.email,
        name: a.name,
        avatarUrl: a.avatarUrl,
        deactivatedAt: a.deactivatedAt,
      });
    }

    // Get comment counts for all tasks
    const commentCountsData =
      taskIds.length > 0
        ? await db
            .select({
              taskId: comments.taskId,
            })
            .from(comments)
            .where(inArray(comments.taskId, taskIds))
        : [];

    const commentCountsByTask = new Map<string, number>();
    for (const c of commentCountsData) {
      commentCountsByTask.set(c.taskId, (commentCountsByTask.get(c.taskId) || 0) + 1);
    }

    // Get attachment counts for all tasks (attachments.taskId is nullable)
    const attachmentCountsData =
      taskIds.length > 0
        ? await db
            .select({
              taskId: attachments.taskId,
            })
            .from(attachments)
            .where(inArray(attachments.taskId, taskIds))
        : [];

    const attachmentCountsByTask = new Map<string, number>();
    for (const a of attachmentCountsData) {
      if (a.taskId) {
        attachmentCountsByTask.set(a.taskId, (attachmentCountsByTask.get(a.taskId) || 0) + 1);
      }
    }

    // Get task view timestamps for the current user
    const taskViewsData =
      taskIds.length > 0
        ? await db
            .select({
              taskId: taskViews.taskId,
              viewedAt: taskViews.viewedAt,
            })
            .from(taskViews)
            .where(and(inArray(taskViews.taskId, taskIds), eq(taskViews.userId, user.id)))
        : [];

    const taskViewByTask = new Map<string, Date>();
    for (const tv of taskViewsData) {
      taskViewByTask.set(tv.taskId, tv.viewedAt);
    }

    // Get latest comment timestamps for tasks with comments
    const latestCommentData =
      taskIds.length > 0
        ? await db
            .select({
              taskId: comments.taskId,
              createdAt: comments.createdAt,
            })
            .from(comments)
            .where(inArray(comments.taskId, taskIds))
        : [];

    const latestCommentByTask = new Map<string, Date>();
    for (const c of latestCommentData) {
      const existing = latestCommentByTask.get(c.taskId);
      if (!existing || c.createdAt > existing) {
        latestCommentByTask.set(c.taskId, c.createdAt);
      }
    }

    // Get subtask counts for parent tasks
    const subtaskCountsData =
      taskIds.length > 0
        ? await db
            .select({
              parentId: tasks.parentTaskId,
              count: sql<number>`COUNT(*)::int`,
            })
            .from(tasks)
            .where(inArray(tasks.parentTaskId, taskIds))
            .groupBy(tasks.parentTaskId)
        : [];

    const subtaskCountByParent = new Map<string, number>();
    for (const s of subtaskCountsData) {
      if (s.parentId) subtaskCountByParent.set(s.parentId, s.count);
    }

    // Get completed subtask counts — collect all status options across source boards
    const allBoardStatusOptions = rollup.rollupSources.flatMap(
      (s) => (s.sourceBoard as { statusOptions?: StatusOption[] }).statusOptions ?? []
    );
    const completeStatusIds = allBoardStatusOptions
      .filter(
        (s) =>
          s.id === 'complete' ||
          s.id === 'done' ||
          s.label.toLowerCase().includes('complete') ||
          s.label.toLowerCase().includes('done')
      )
      .map((s) => s.id);

    const completedSubtaskCountsData =
      taskIds.length > 0 && completeStatusIds.length > 0
        ? await db
            .select({
              parentId: tasks.parentTaskId,
              count: sql<number>`COUNT(*)::int`,
            })
            .from(tasks)
            .where(
              and(
                inArray(tasks.parentTaskId, taskIds),
                inArray(tasks.status, completeStatusIds)
              )
            )
            .groupBy(tasks.parentTaskId)
        : [];

    const completedSubtaskCountByParent = new Map<string, number>();
    for (const s of completedSubtaskCountsData) {
      if (s.parentId) completedSubtaskCountByParent.set(s.parentId, s.count);
    }

    // Build source board lookup
    const boardLookup = new Map(
      rollup.rollupSources.map((s) => [
        s.sourceBoardId,
        {
          boardName: s.sourceBoard.name,
          clientId: s.sourceBoard.client?.id ?? null,
          clientName: s.sourceBoard.client?.name ?? null,
          clientSlug: s.sourceBoard.client?.slug ?? null,
          clientColor: s.sourceBoard.client?.color ?? null,
          clientIcon: s.sourceBoard.client?.icon ?? null,
        },
      ])
    );

    // Filter tasks based on access level (assigned_only)
    const filteredTasks = allTasks.filter((task) => {
      const accessLevel = accessLevels.get(task.boardId);
      if (accessLevel === 'full') {
        return true;
      }
      // For assigned_only, check if user is assigned
      const taskAssigneeIds = assigneesByTask.get(task.id)?.map((a) => a.id) ?? [];
      return taskAssigneeIds.includes(user.id);
    });

    // Apply assignee filter if specified
    let finalTasks = filteredTasks;
    if (filters?.assigneeId) {
      const assigneeIds = Array.isArray(filters.assigneeId)
        ? filters.assigneeId
        : [filters.assigneeId];
      const isNotMode = filters.assigneeMode === 'is_not';
      finalTasks = filteredTasks.filter((task) => {
        const taskAssigneeIds = assigneesByTask.get(task.id)?.map((a) => a.id) ?? [];
        const hasMatch = assigneeIds.some((id) => taskAssigneeIds.includes(id));
        return isNotMode ? !hasMatch : hasMatch;
      });
    }

    // Build response tasks
    const resultTasks: RollupTaskWithAssignees[] = finalTasks.map((task) => {
      const boardInfo = boardLookup.get(task.boardId)!;
      const commentCount = commentCountsByTask.get(task.id) || 0;
      const attachmentCount = attachmentCountsByTask.get(task.id) || 0;
      const viewedAt = taskViewByTask.get(task.id);
      const latestComment = latestCommentByTask.get(task.id);
      const hasNewComments = commentCount > 0 && latestComment
        ? (!viewedAt || latestComment > viewedAt)
        : false;

      return {
        id: task.id,
        boardId: task.boardId,
        boardName: boardInfo.boardName,
        clientId: boardInfo.clientId,
        clientName: boardInfo.clientName,
        clientSlug: boardInfo.clientSlug,
        clientColor: boardInfo.clientColor,
        clientIcon: boardInfo.clientIcon,
        title: task.title,
        description: task.description,
        status: task.status,
        section: task.section,
        dueDate: task.dueDate,
        dateFlexibility: task.dateFlexibility,
        recurringConfig: task.recurringConfig,
        recurringGroupId: task.recurringGroupId,
        position: task.position,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        assignees: assigneesByTask.get(task.id) ?? [],
        commentCount,
        attachmentCount,
        hasNewComments,
        parentTaskId: task.parentTaskId ?? null,
        subtaskCount: subtaskCountByParent.get(task.id) ?? 0,
        subtaskCompletedCount: completedSubtaskCountByParent.get(task.id) ?? 0,
        archivedAt: task.archivedAt ?? null,
      };
    });

    // Aggregate status and section options from all source boards
    const statusOptionsMap = new Map<string, StatusOption>();
    const sectionOptionsMap = new Map<string, SectionOption>();

    for (const source of rollup.rollupSources) {
      const sourceBoard = await db.query.boards.findFirst({
        where: eq(boards.id, source.sourceBoardId),
      });

      if (sourceBoard) {
        for (const status of sourceBoard.statusOptions) {
          if (!statusOptionsMap.has(status.id)) {
            statusOptionsMap.set(status.id, status);
          }
        }
        for (const section of sourceBoard.sectionOptions ?? []) {
          if (!sectionOptionsMap.has(section.id)) {
            sectionOptionsMap.set(section.id, section);
          }
        }
      }
    }

    // Sort options by position
    const statusOptions = Array.from(statusOptionsMap.values()).sort(
      (a, b) => a.position - b.position
    );
    const sectionOptions = Array.from(sectionOptionsMap.values()).sort(
      (a, b) => a.position - b.position
    );

    return {
      success: true,
      data: {
        tasks: resultTasks,
        statusOptions,
        sectionOptions,
      },
    };
  } catch (error) {
    console.error('getRollupTasks error:', error);
    return { success: false, error: 'Failed to get rollup tasks' };
  }
}

/**
 * Get all boards available to be used as sources for a rollup
 * Returns standard boards the user has access to
 */
export async function getAvailableSourceBoards(): Promise<
  ActionResult<
    {
      id: string;
      name: string;
      clientId: string | null;
      clientName: string | null;
      clientSlug: string | null;
      clientColor: string | null;
      clientIcon: string | null;
    }[]
  >
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userIsAdmin = user.role === 'admin';

    // Get standard boards
    let standardBoards;

    if (userIsAdmin) {
      standardBoards = await db.query.boards.findMany({
        where: eq(boards.type, 'standard'),
        with: {
          client: {
            columns: { id: true, name: true, slug: true, color: true, icon: true },
          },
        },
        orderBy: (boards, { asc }) => [asc(boards.name)],
      });
    } else {
      // Check if user is in a contractor team
      const isContractor = await isUserInContractorTeam(user.id);

      if (!isContractor) {
        // Non-contractors see all standard boards (public by default)
        standardBoards = await db.query.boards.findMany({
          where: eq(boards.type, 'standard'),
          with: {
            client: {
              columns: { id: true, name: true, slug: true, color: true, icon: true },
            },
          },
          orderBy: (boards, { asc }) => [asc(boards.name)],
        });
      } else {
        // Contractors only see boards with explicit access
        const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);

        if (accessibleBoardIds.length === 0) {
          return { success: true, data: [] };
        }

        standardBoards = await db.query.boards.findMany({
          where: and(
            eq(boards.type, 'standard'),
            inArray(boards.id, accessibleBoardIds)
          ),
          with: {
            client: {
              columns: { id: true, name: true, slug: true, color: true, icon: true },
            },
          },
          orderBy: (boards, { asc }) => [asc(boards.name)],
        });
      }
    }

    return {
      success: true,
      data: standardBoards.map((board) => ({
        id: board.id,
        name: board.name,
        clientId: board.client?.id ?? null,
        clientName: board.client?.name ?? null,
        clientSlug: board.client?.slug ?? null,
        clientColor: board.client?.color ?? null,
        clientIcon: board.client?.icon ?? null,
      })),
    };
  } catch (error) {
    console.error('getAvailableSourceBoards error:', error);
    return { success: false, error: 'Failed to get available source boards' };
  }
}
