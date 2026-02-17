'use server';

import { db } from '@/lib/db';
import { boards, boardAccess, clients, teams, users, teamMembers, statuses, sections } from '@/lib/db/schema';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import { eq, and, not, inArray, or, asc } from 'drizzle-orm';
import { getCurrentUser, requireAdmin, requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import {
  createBoardSchema,
  updateBoardSchema,
  addBoardAccessSchema,
  updateBoardAccessSchema,
  type CreateBoardInput,
  type UpdateBoardInput,
  type AddBoardAccessInput,
  type UpdateBoardAccessInput,
} from '@/lib/validations/board';

// Types
export interface BoardAccessEntry {
  id: string;
  userId: string | null;
  teamId: string | null;
  accessLevel: 'full' | 'assigned_only';
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
}

export interface BoardWithAccess {
  id: string;
  name: string;
  type: 'standard' | 'rollup' | 'personal';
  clientId: string | null;
  color: string | null;
  icon: string | null;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  createdBy: string | null;
  createdAt: Date;
  client: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  } | null;
  access: BoardAccessEntry[];
}

export interface BoardSummary {
  id: string;
  name: string;
  type: 'standard' | 'rollup' | 'personal';
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
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

/**
 * Get board IDs that a user has explicit access to (directly or via team membership)
 * Used for contractors who need explicit access entries
 */
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

/**
 * Check if user has access to a board with optional required level
 * Boards are PUBLIC by default - everyone can access unless they're in a contractor team
 * Contractor teams (excludeFromPublic = true) need explicit board_access entries
 */
async function canAccessBoard(
  userId: string,
  boardId: string,
  requiredLevel?: 'full'
): Promise<boolean> {
  // Check if user is in a contractor team
  const isContractor = await isUserInContractorTeam(userId);

  // Non-contractors have full access to all boards (public by default)
  if (!isContractor) {
    // If requiredLevel is specified, non-contractors still get 'full' access
    return true;
  }

  // Contractors need explicit access entries
  // Get user's team IDs
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  const teamIds = userTeams.map((t) => t.teamId);

  // Check direct user access
  const directAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      eq(boardAccess.userId, userId)
    ),
  });

  if (directAccess) {
    if (!requiredLevel || directAccess.accessLevel === requiredLevel) {
      return true;
    }
  }

  // Check team access
  if (teamIds.length > 0) {
    const teamAccess = await db.query.boardAccess.findFirst({
      where: and(
        eq(boardAccess.boardId, boardId),
        inArray(boardAccess.teamId, teamIds)
      ),
    });

    if (teamAccess) {
      if (!requiredLevel || teamAccess.accessLevel === requiredLevel) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if user can edit a board (admin or has 'full' access)
 */
export async function canUserEditBoard(userId: string, boardId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return canAccessBoard(userId, boardId, 'full');
}

/**
 * List boards, optionally filtered by client
 */
export async function listBoards(clientId?: string): Promise<ActionResult<BoardSummary[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userIsAdmin = user.role === 'admin';

    // Base condition: exclude personal boards from regular listings
    const excludePersonal = not(eq(boards.type, 'personal'));

    if (userIsAdmin) {
      // Admin: get all boards
      const adminConditions = [excludePersonal];
      if (clientId) adminConditions.push(eq(boards.clientId, clientId));

      const allBoards = await db.query.boards.findMany({
        where: and(...adminConditions),
        with: {
          client: {
            columns: { id: true, name: true, slug: true },
          },
        },
        orderBy: (boards, { asc }) => [asc(boards.name)],
      });

      return {
        success: true,
        data: allBoards.map((board) => ({
          id: board.id,
          name: board.name,
          type: board.type,
          clientId: board.clientId,
          clientName: board.client?.name ?? null,
          clientSlug: board.client?.slug ?? null,
        })),
      };
    }

    // Check if user is in a contractor team
    const isContractor = await isUserInContractorTeam(user.id);

    if (!isContractor) {
      // Non-contractors see all boards (public by default)
      const publicConditions = [excludePersonal];
      if (clientId) publicConditions.push(eq(boards.clientId, clientId));

      const allBoards = await db.query.boards.findMany({
        where: and(...publicConditions),
        with: {
          client: {
            columns: { id: true, name: true, slug: true },
          },
        },
        orderBy: (boards, { asc }) => [asc(boards.name)],
      });

      return {
        success: true,
        data: allBoards.map((board) => ({
          id: board.id,
          name: board.name,
          type: board.type,
          clientId: board.clientId,
          clientName: board.client?.name ?? null,
          clientSlug: board.client?.slug ?? null,
        })),
      };
    }

    // Contractors only see boards they have explicit access to
    const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);

    if (accessibleBoardIds.length === 0) {
      return { success: true, data: [] };
    }

    const conditions = [inArray(boards.id, accessibleBoardIds), excludePersonal];
    if (clientId) {
      conditions.push(eq(boards.clientId, clientId));
    }

    const accessibleBoards = await db.query.boards.findMany({
      where: and(...conditions),
      with: {
        client: {
          columns: { id: true, name: true, slug: true },
        },
      },
      orderBy: (boards, { asc }) => [asc(boards.name)],
    });

    return {
      success: true,
      data: accessibleBoards.map((board) => ({
        id: board.id,
        name: board.name,
        type: board.type,
        clientId: board.clientId,
        clientName: board.client?.name ?? null,
        clientSlug: board.client?.slug ?? null,
      })),
    };
  } catch (error) {
    console.error('listBoards error:', error);
    return { success: false, error: 'Failed to list boards' };
  }
}

/**
 * Get a single board with its access entries
 */
export async function getBoard(boardId: string): Promise<ActionResult<BoardWithAccess | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userIsAdmin = user.role === 'admin';

    // Check access for non-admins
    if (!userIsAdmin) {
      const hasAccess = await canAccessBoard(user.id, boardId);
      if (!hasAccess) {
        return { success: true, data: null };
      }
    }

    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        client: {
          columns: { id: true, name: true, slug: true, color: true },
        },
        access: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, avatarUrl: true },
            },
            team: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!board) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: board.id,
        name: board.name,
        type: board.type,
        clientId: board.clientId,
        color: board.color ?? null,
        icon: board.icon ?? null,
        statusOptions: board.statusOptions,
        sectionOptions: board.sectionOptions ?? [],
        createdBy: board.createdBy,
        createdAt: board.createdAt,
        client: board.client,
        access: board.access.map((a) => ({
          id: a.id,
          userId: a.userId,
          teamId: a.teamId,
          accessLevel: a.accessLevel,
          user: a.user,
          team: a.team,
        })),
      },
    };
  } catch (error) {
    console.error('getBoard error:', error);
    return { success: false, error: 'Failed to get board' };
  }
}

/**
 * Create a new board (admin only)
 */
export async function createBoard(input: CreateBoardInput): Promise<ActionResult<BoardWithAccess>> {
  try {
    const user = await requireAdmin();

    // Validate input
    const validation = createBoardSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { clientId, name, statusOptions, sectionOptions } = validation.data;

    // Verify client exists
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
    });

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    // If no status options provided, fetch from global statuses table
    let boardStatusOptions: StatusOption[] | undefined = statusOptions;
    if (!boardStatusOptions) {
      const globalStatuses = await db.query.statuses.findMany({
        orderBy: [asc(statuses.position)],
      });
      if (globalStatuses.length > 0) {
        boardStatusOptions = globalStatuses.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }));
      }
    }

    // If no section options provided, fetch from global sections table
    let boardSectionOptions: SectionOption[] | undefined = sectionOptions;
    if (!boardSectionOptions) {
      const globalSections = await db.query.sections.findMany({
        orderBy: [asc(sections.position)],
      });
      if (globalSections.length > 0) {
        boardSectionOptions = globalSections.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }));
      }
    }

    // Create board with global or custom status/section options
    const [newBoard] = await db
      .insert(boards)
      .values({
        clientId,
        name,
        type: 'standard',
        statusOptions: boardStatusOptions, // Uses global statuses if not provided
        sectionOptions: boardSectionOptions ?? [],
        createdBy: user.id,
      })
      .returning();

    revalidatePath(`/clients/${client.slug}`);
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: {
        id: newBoard.id,
        name: newBoard.name,
        type: newBoard.type,
        clientId: newBoard.clientId,
        color: newBoard.color ?? null,
        icon: newBoard.icon ?? null,
        statusOptions: newBoard.statusOptions,
        sectionOptions: newBoard.sectionOptions ?? [],
        createdBy: newBoard.createdBy,
        createdAt: newBoard.createdAt,
        client: {
          id: client.id,
          name: client.name,
          slug: client.slug,
          color: client.color,
        },
        access: [],
      },
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('createBoard error:', error);
    return { success: false, error: 'Failed to create board' };
  }
}

/**
 * Update a board (admin or user with 'full' access)
 */
export async function updateBoard(
  boardId: string,
  input: UpdateBoardInput
): Promise<ActionResult<BoardWithAccess>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate input
    const validation = updateBoardSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const updateData = validation.data;

    // Check permission
    const userIsAdmin = user.role === 'admin';
    if (!userIsAdmin) {
      const hasFullAccess = await canAccessBoard(user.id, boardId, 'full');
      if (!hasFullAccess) {
        return { success: false, error: 'Permission denied' };
      }
    }

    // Get existing board
    const existingBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        client: {
          columns: { id: true, name: true, slug: true, color: true },
        },
        access: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, avatarUrl: true },
            },
            team: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!existingBoard) {
      return { success: false, error: 'Board not found' };
    }

    // Update board
    const [updatedBoard] = await db
      .update(boards)
      .set({
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.statusOptions !== undefined && { statusOptions: updateData.statusOptions }),
        ...(updateData.sectionOptions !== undefined && { sectionOptions: updateData.sectionOptions }),
        ...(updateData.color !== undefined && { color: updateData.color }),
        ...(updateData.icon !== undefined && { icon: updateData.icon }),
      })
      .where(eq(boards.id, boardId))
      .returning();

    if (existingBoard.client) {
      revalidatePath(`/clients/${existingBoard.client.slug}`);
      revalidatePath(`/clients/${existingBoard.client.slug}/boards/${boardId}/settings`);
    }

    return {
      success: true,
      data: {
        id: updatedBoard.id,
        name: updatedBoard.name,
        type: updatedBoard.type,
        clientId: updatedBoard.clientId,
        color: updatedBoard.color ?? null,
        icon: updatedBoard.icon ?? null,
        statusOptions: updatedBoard.statusOptions,
        sectionOptions: updatedBoard.sectionOptions ?? [],
        createdBy: updatedBoard.createdBy,
        createdAt: updatedBoard.createdAt,
        client: existingBoard.client,
        access: existingBoard.access.map((a) => ({
          id: a.id,
          userId: a.userId,
          teamId: a.teamId,
          accessLevel: a.accessLevel,
          user: a.user,
          team: a.team,
        })),
      },
    };
  } catch (error) {
    console.error('updateBoard error:', error);
    return { success: false, error: 'Failed to update board' };
  }
}

/**
 * Delete a board (admin only)
 */
export async function deleteBoard(boardId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Get board with client for revalidation
    const existingBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        client: {
          columns: { slug: true },
        },
      },
    });

    if (!existingBoard) {
      return { success: false, error: 'Board not found' };
    }

    if (existingBoard.type === 'personal') {
      return { success: false, error: 'Personal boards cannot be deleted' };
    }

    // Delete board (access entries cascade via FK)
    await db.delete(boards).where(eq(boards.id, boardId));

    if (existingBoard.client) {
      revalidatePath(`/clients/${existingBoard.client.slug}`);
    }
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('deleteBoard error:', error);
    return { success: false, error: 'Failed to delete board' };
  }
}

/**
 * Add access to a board (admin only)
 */
export async function addBoardAccess(input: AddBoardAccessInput): Promise<ActionResult<BoardAccessEntry>> {
  try {
    await requireAdmin();

    // Validate input
    const validation = addBoardAccessSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { boardId, userId, teamId, accessLevel } = validation.data;

    // Verify board exists
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
        client: { columns: { slug: true } },
      },
    });

    if (!board) {
      return { success: false, error: 'Board not found' };
    }

    // Verify user or team exists
    if (userId) {
      const userExists = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!userExists) {
        return { success: false, error: 'User not found' };
      }

      // Check for duplicate access
      const existingAccess = await db.query.boardAccess.findFirst({
        where: and(eq(boardAccess.boardId, boardId), eq(boardAccess.userId, userId)),
      });
      if (existingAccess) {
        return { success: false, error: 'User already has access to this board' };
      }
    }

    if (teamId) {
      const teamExists = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
      });
      if (!teamExists) {
        return { success: false, error: 'Team not found' };
      }

      // Check for duplicate access
      const existingAccess = await db.query.boardAccess.findFirst({
        where: and(eq(boardAccess.boardId, boardId), eq(boardAccess.teamId, teamId)),
      });
      if (existingAccess) {
        return { success: false, error: 'Team already has access to this board' };
      }
    }

    // Create access entry
    const [newAccess] = await db
      .insert(boardAccess)
      .values({
        boardId,
        userId: userId ?? null,
        teamId: teamId ?? null,
        accessLevel,
      })
      .returning();

    // Fetch the full access entry with relations
    const fullAccess = await db.query.boardAccess.findFirst({
      where: eq(boardAccess.id, newAccess.id),
      with: {
        user: {
          columns: { id: true, name: true, email: true, avatarUrl: true },
        },
        team: {
          columns: { id: true, name: true },
        },
      },
    });

    if (board.client) {
      revalidatePath(`/clients/${board.client.slug}/boards/${boardId}/settings`);
    }

    return {
      success: true,
      data: {
        id: fullAccess!.id,
        userId: fullAccess!.userId,
        teamId: fullAccess!.teamId,
        accessLevel: fullAccess!.accessLevel,
        user: fullAccess!.user,
        team: fullAccess!.team,
      },
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('addBoardAccess error:', error);
    return { success: false, error: 'Failed to add board access' };
  }
}

/**
 * Update board access level (admin only)
 */
export async function updateBoardAccess(input: UpdateBoardAccessInput): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Validate input
    const validation = updateBoardAccessSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { accessId, accessLevel } = validation.data;

    // Check if access entry exists
    const existingAccess = await db.query.boardAccess.findFirst({
      where: eq(boardAccess.id, accessId),
      with: {
        board: {
          with: {
            client: { columns: { slug: true } },
          },
        },
      },
    });

    if (!existingAccess) {
      return { success: false, error: 'Access entry not found' };
    }

    // Update access level
    await db
      .update(boardAccess)
      .set({ accessLevel })
      .where(eq(boardAccess.id, accessId));

    if (existingAccess.board?.client) {
      revalidatePath(`/clients/${existingAccess.board.client.slug}/boards/${existingAccess.boardId}/settings`);
    }

    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('updateBoardAccess error:', error);
    return { success: false, error: 'Failed to update board access' };
  }
}

/**
 * Remove board access (admin only)
 */
export async function removeBoardAccess(accessId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Check if access entry exists
    const existingAccess = await db.query.boardAccess.findFirst({
      where: eq(boardAccess.id, accessId),
      with: {
        board: {
          with: {
            client: { columns: { slug: true } },
          },
        },
      },
    });

    if (!existingAccess) {
      return { success: false, error: 'Access entry not found' };
    }

    // Delete access entry
    await db.delete(boardAccess).where(eq(boardAccess.id, accessId));

    if (existingAccess.board?.client) {
      revalidatePath(`/clients/${existingAccess.board.client.slug}/boards/${existingAccess.boardId}/settings`);
    }

    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('removeBoardAccess error:', error);
    return { success: false, error: 'Failed to remove board access' };
  }
}

/**
 * Get all users (for access management)
 */
export async function listUsers(): Promise<ActionResult<{ id: string; name: string | null; email: string; avatarUrl: string | null }[]>> {
  try {
    await requireAdmin();

    const allUsers = await db.query.users.findMany({
      columns: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: (users, { asc }) => [asc(users.name), asc(users.email)],
    });

    return { success: true, data: allUsers };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('listUsers error:', error);
    return { success: false, error: 'Failed to list users' };
  }
}

/**
 * Get all teams (for access management)
 */
export async function listTeams(): Promise<ActionResult<{ id: string; name: string }[]>> {
  try {
    await requireAdmin();

    const allTeams = await db.query.teams.findMany({
      columns: { id: true, name: true },
      orderBy: (teams, { asc }) => [asc(teams.name)],
    });

    return { success: true, data: allTeams };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('listTeams error:', error);
    return { success: false, error: 'Failed to list teams' };
  }
}

/**
 * Get or create a personal board for the current user
 */
export async function getOrCreatePersonalBoard(): Promise<ActionResult<BoardWithAccess>> {
  try {
    const user = await requireAuth();

    // Check for existing personal board
    const existing = await db.query.boards.findFirst({
      where: and(
        eq(boards.type, 'personal'),
        eq(boards.createdBy, user.id)
      ),
      with: {
        client: {
          columns: { id: true, name: true, slug: true, color: true },
        },
        access: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, avatarUrl: true },
            },
            team: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    });

    if (existing) {
      return {
        success: true,
        data: {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          clientId: existing.clientId,
          color: existing.color ?? null,
          icon: existing.icon ?? null,
          statusOptions: existing.statusOptions,
          sectionOptions: existing.sectionOptions ?? [],
          createdBy: existing.createdBy,
          createdAt: existing.createdAt,
          client: existing.client,
          access: existing.access.map((a) => ({
            id: a.id,
            userId: a.userId,
            teamId: a.teamId,
            accessLevel: a.accessLevel,
            user: a.user,
            team: a.team,
          })),
        },
      };
    }

    // Fetch global default statuses
    const globalStatuses = await db.query.statuses.findMany({
      orderBy: [asc(statuses.position)],
    });
    const boardStatusOptions: StatusOption[] = globalStatuses.length > 0
      ? globalStatuses.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }))
      : [
          { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
          { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
          { id: 'review', label: 'Review', color: '#F59E0B', position: 2 },
          { id: 'complete', label: 'Complete', color: '#10B981', position: 3 },
        ];

    // Fetch global default sections
    const globalSections = await db.query.sections.findMany({
      orderBy: [asc(sections.position)],
    });
    const boardSectionOptions: SectionOption[] = globalSections.length > 0
      ? globalSections.map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          position: s.position,
        }))
      : [];

    // Create personal board
    const [newBoard] = await db
      .insert(boards)
      .values({
        name: 'Personal List',
        type: 'personal',
        clientId: null,
        statusOptions: boardStatusOptions,
        sectionOptions: boardSectionOptions,
        createdBy: user.id,
      })
      .returning();

    return {
      success: true,
      data: {
        id: newBoard.id,
        name: newBoard.name,
        type: newBoard.type,
        clientId: null,
        color: newBoard.color ?? null,
        icon: newBoard.icon ?? null,
        statusOptions: newBoard.statusOptions,
        sectionOptions: newBoard.sectionOptions ?? [],
        createdBy: newBoard.createdBy,
        createdAt: newBoard.createdAt,
        client: null,
        access: [],
      },
    };
  } catch (error) {
    console.error('getOrCreatePersonalBoard error:', error);
    return { success: false, error: 'Failed to get personal board' };
  }
}

/**
 * Update a personal board (owner only - name, color, icon, statuses, sections)
 */
export async function updatePersonalBoard(input: UpdateBoardInput): Promise<ActionResult<BoardWithAccess>> {
  try {
    const user = await requireAuth();

    // Validate input
    const validation = updateBoardSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const updateData = validation.data;

    // Find the user's personal board
    const personalBoard = await db.query.boards.findFirst({
      where: and(
        eq(boards.type, 'personal'),
        eq(boards.createdBy, user.id)
      ),
    });

    if (!personalBoard) {
      return { success: false, error: 'Personal board not found' };
    }

    // Update board
    const [updatedBoard] = await db
      .update(boards)
      .set({
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.statusOptions !== undefined && { statusOptions: updateData.statusOptions }),
        ...(updateData.sectionOptions !== undefined && { sectionOptions: updateData.sectionOptions }),
        ...(updateData.color !== undefined && { color: updateData.color }),
        ...(updateData.icon !== undefined && { icon: updateData.icon }),
      })
      .where(eq(boards.id, personalBoard.id))
      .returning();

    revalidatePath('/my-tasks');

    return {
      success: true,
      data: {
        id: updatedBoard.id,
        name: updatedBoard.name,
        type: updatedBoard.type,
        clientId: null,
        color: updatedBoard.color ?? null,
        icon: updatedBoard.icon ?? null,
        statusOptions: updatedBoard.statusOptions,
        sectionOptions: updatedBoard.sectionOptions ?? [],
        createdBy: updatedBoard.createdBy,
        createdAt: updatedBoard.createdAt,
        client: null,
        access: [],
      },
    };
  } catch (error) {
    console.error('updatePersonalBoard error:', error);
    return { success: false, error: 'Failed to update personal board' };
  }
}
