'use server';

import { db } from '@/lib/db';
import { clients, boards, boardAccess, teamMembers, teams, statuses, sections } from '@/lib/db/schema';
import { eq, and, inArray, or, isNotNull, asc } from 'drizzle-orm';
import { getCurrentUser, requireAuth, requireAdmin, isAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { createClientSchema, updateClientSchema, type CreateClientInput, type UpdateClientInput } from '@/lib/validations/client';

import type { ClientMetadata } from '@/lib/db/schema';

// Types
export interface ClientWithBoards {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  leadUserId: string | null;
  defaultBoardId: string | null;
  metadata: ClientMetadata | null;
  createdBy: string | null;
  createdAt: Date;
  boards: {
    id: string;
    name: string;
    type: 'standard' | 'rollup' | 'personal';
  }[];
  leadUser?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
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
 * Check if user is in a contractor team (public helper for layout)
 */
export async function checkIsContractor(userId: string): Promise<boolean> {
  return isUserInContractorTeam(userId);
}

/**
 * List all clients with their boards
 * Admins see all clients, users only see clients with accessible boards
 */
export async function listClients(): Promise<ActionResult<ClientWithBoards[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userIsAdmin = user.role === 'admin';

    if (userIsAdmin) {
      // Admin: get all clients with all boards
      const allClients = await db.query.clients.findMany({
        with: {
          boards: {
            columns: {
              id: true,
              name: true,
              type: true,
            },
          },
          leadUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: (clients, { asc }) => [asc(clients.name)],
      });

      return {
        success: true,
        data: allClients.map((client) => ({
          id: client.id,
          name: client.name,
          slug: client.slug,
          color: client.color,
          icon: client.icon,
          leadUserId: client.leadUserId,
          defaultBoardId: client.defaultBoardId,
          metadata: client.metadata,
          createdBy: client.createdBy,
          createdAt: client.createdAt,
          boards: client.boards,
          leadUser: client.leadUser,
        })),
      };
    }

    // Check if user is in a contractor team
    const isContractor = await isUserInContractorTeam(user.id);

    if (!isContractor) {
      // Non-contractors see all clients with all boards (public by default)
      const allClients = await db.query.clients.findMany({
        with: {
          boards: {
            columns: {
              id: true,
              name: true,
              type: true,
            },
          },
          leadUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: (clients, { asc }) => [asc(clients.name)],
      });

      return {
        success: true,
        data: allClients.map((client) => ({
          id: client.id,
          name: client.name,
          slug: client.slug,
          color: client.color,
          icon: client.icon,
          leadUserId: client.leadUserId,
          defaultBoardId: client.defaultBoardId,
          metadata: client.metadata,
          createdBy: client.createdBy,
          createdAt: client.createdAt,
          boards: client.boards,
          leadUser: client.leadUser,
        })),
      };
    }

    // Contractors: only clients with boards they have explicit access to
    const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);

    if (accessibleBoardIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get boards the user has access to
    const accessibleBoards = await db.query.boards.findMany({
      where: inArray(boards.id, accessibleBoardIds),
      columns: {
        id: true,
        name: true,
        type: true,
        clientId: true,
      },
    });

    // Get unique client IDs
    const clientIds = [...new Set(accessibleBoards.filter((b) => b.clientId).map((b) => b.clientId!))];

    if (clientIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get clients
    const clientsData = await db.query.clients.findMany({
      where: inArray(clients.id, clientIds),
      with: {
        leadUser: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: (clients, { asc }) => [asc(clients.name)],
    });

    // Map boards to clients
    const result: ClientWithBoards[] = clientsData.map((client) => ({
      id: client.id,
      name: client.name,
      slug: client.slug,
      color: client.color,
      icon: client.icon,
      leadUserId: client.leadUserId,
      defaultBoardId: client.defaultBoardId,
      metadata: client.metadata,
      createdBy: client.createdBy,
      createdAt: client.createdAt,
      boards: accessibleBoards
        .filter((b) => b.clientId === client.id)
        .map((b) => ({ id: b.id, name: b.name, type: b.type })),
      leadUser: client.leadUser,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('listClients error:', error);
    return { success: false, error: 'Failed to list clients' };
  }
}

/**
 * Get a single client by slug with its boards
 */
export async function getClient(slug: string): Promise<ActionResult<ClientWithBoards | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userIsAdmin = user.role === 'admin';

    const client = await db.query.clients.findFirst({
      where: eq(clients.slug, slug),
      with: {
        boards: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
        leadUser: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!client) {
      return { success: true, data: null };
    }

    if (userIsAdmin) {
      // Admin sees all boards
      return {
        success: true,
        data: {
          id: client.id,
          name: client.name,
          slug: client.slug,
          color: client.color,
          icon: client.icon,
          leadUserId: client.leadUserId,
          defaultBoardId: client.defaultBoardId,
          metadata: client.metadata,
          createdBy: client.createdBy,
          createdAt: client.createdAt,
          boards: client.boards,
          leadUser: client.leadUser,
        },
      };
    }

    // Check if user is in a contractor team
    const isContractor = await isUserInContractorTeam(user.id);

    if (!isContractor) {
      // Non-contractors see all boards (public by default)
      return {
        success: true,
        data: {
          id: client.id,
          name: client.name,
          slug: client.slug,
          color: client.color,
          icon: client.icon,
          leadUserId: client.leadUserId,
          defaultBoardId: client.defaultBoardId,
          metadata: client.metadata,
          createdBy: client.createdBy,
          createdAt: client.createdAt,
          boards: client.boards,
          leadUser: client.leadUser,
        },
      };
    }

    // Contractors: filter to boards with explicit access
    const accessibleBoardIds = await getExplicitAccessBoardIds(user.id);
    const accessibleBoards = client.boards.filter((b) => accessibleBoardIds.includes(b.id));

    // If contractor has no access to any boards in this client, return null
    if (accessibleBoards.length === 0) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        color: client.color,
        icon: client.icon,
        leadUserId: client.leadUserId,
        defaultBoardId: client.defaultBoardId,
        metadata: client.metadata,
        createdBy: client.createdBy,
        createdAt: client.createdAt,
        boards: accessibleBoards,
        leadUser: client.leadUser,
      },
    };
  } catch (error) {
    console.error('getClient error:', error);
    return { success: false, error: 'Failed to get client' };
  }
}

/**
 * Create a new client (admin only)
 */
export async function createClient(input: CreateClientInput): Promise<ActionResult<ClientWithBoards>> {
  try {
    const user = await requireAuth();

    // Contractors cannot create clients
    const contractor = await isUserInContractorTeam(user.id);
    if (contractor) {
      return { success: false, error: 'Contractors cannot create clients' };
    }

    // Validate input
    const validation = createClientSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const { name, slug, color, icon, leadUserId, defaultBoardId, metadata } = validation.data;

    // Check slug uniqueness
    const existingClient = await db.query.clients.findFirst({
      where: eq(clients.slug, slug),
    });

    if (existingClient) {
      return { success: false, error: 'A client with this slug already exists' };
    }

    // Create client
    const [newClient] = await db
      .insert(clients)
      .values({
        name,
        slug,
        color: color ?? null,
        icon: icon ?? null,
        leadUserId: leadUserId ?? null,
        defaultBoardId: defaultBoardId ?? null,
        metadata: metadata ?? {},
        createdBy: user.id,
      })
      .returning();

    // Create a default board with the same name as the client
    const globalStatuses = await db.query.statuses.findMany({
      orderBy: [asc(statuses.position)],
    });
    const boardStatusOptions = globalStatuses.length > 0
      ? globalStatuses.map((s) => ({ id: s.id, label: s.label, color: s.color, position: s.position }))
      : undefined;

    const globalSections = await db.query.sections.findMany({
      orderBy: [asc(sections.position)],
    });
    const boardSectionOptions = globalSections.length > 0
      ? globalSections.map((s) => ({ id: s.id, label: s.label, color: s.color, position: s.position }))
      : [];

    const [defaultBoard] = await db
      .insert(boards)
      .values({
        clientId: newClient.id,
        name,
        type: 'standard',
        statusOptions: boardStatusOptions,
        sectionOptions: boardSectionOptions,
        createdBy: user.id,
      })
      .returning();

    // Set it as the client's default board
    await db
      .update(clients)
      .set({ defaultBoardId: defaultBoard.id })
      .where(eq(clients.id, newClient.id));

    // Grant non-admin creators full access to the default board
    if (user.role !== 'admin') {
      await db.insert(boardAccess).values({
        boardId: defaultBoard.id,
        userId: user.id,
        accessLevel: 'full',
      });
    }

    revalidatePath('/clients');
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: {
        id: newClient.id,
        name: newClient.name,
        slug: newClient.slug,
        color: newClient.color,
        icon: newClient.icon,
        leadUserId: newClient.leadUserId,
        defaultBoardId: defaultBoard.id,
        metadata: newClient.metadata,
        createdBy: newClient.createdBy,
        createdAt: newClient.createdAt,
        boards: [{ id: defaultBoard.id, name: defaultBoard.name, type: defaultBoard.type as 'standard' }],
      },
    };
  } catch (error) {
    console.error('createClient error:', error);
    return { success: false, error: 'Failed to create client' };
  }
}

/**
 * Update a client (admin only)
 */
export async function updateClient(id: string, input: UpdateClientInput): Promise<ActionResult<ClientWithBoards>> {
  try {
    const user = await requireAdmin();

    // Validate input
    const validation = updateClientSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
    }

    const updateData = validation.data;

    // Get existing client
    const existingClient = await db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: {
        boards: {
          columns: { id: true, name: true, type: true },
        },
      },
    });

    if (!existingClient) {
      return { success: false, error: 'Client not found' };
    }

    // Check slug uniqueness if changing
    if (updateData.slug && updateData.slug !== existingClient.slug) {
      const slugConflict = await db.query.clients.findFirst({
        where: eq(clients.slug, updateData.slug),
      });

      if (slugConflict) {
        return { success: false, error: 'A client with this slug already exists' };
      }
    }

    // Update client
    const [updatedClient] = await db
      .update(clients)
      .set({
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.slug !== undefined && { slug: updateData.slug }),
        ...(updateData.color !== undefined && { color: updateData.color ?? null }),
        ...(updateData.icon !== undefined && { icon: updateData.icon ?? null }),
        ...(updateData.leadUserId !== undefined && { leadUserId: updateData.leadUserId ?? null }),
        ...(updateData.defaultBoardId !== undefined && { defaultBoardId: updateData.defaultBoardId ?? null }),
        ...(updateData.metadata !== undefined && { metadata: updateData.metadata ?? {} }),
      })
      .where(eq(clients.id, id))
      .returning();

    revalidatePath('/clients');
    revalidatePath(`/clients/${updatedClient.slug}`);
    revalidatePath('/', 'layout');

    return {
      success: true,
      data: {
        id: updatedClient.id,
        name: updatedClient.name,
        slug: updatedClient.slug,
        color: updatedClient.color,
        icon: updatedClient.icon,
        leadUserId: updatedClient.leadUserId,
        defaultBoardId: updatedClient.defaultBoardId,
        metadata: updatedClient.metadata,
        createdBy: updatedClient.createdBy,
        createdAt: updatedClient.createdAt,
        boards: existingClient.boards,
      },
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('updateClient error:', error);
    return { success: false, error: 'Failed to update client' };
  }
}

/**
 * Delete a client (admin only)
 * This will cascade delete all boards via FK constraint
 */
export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Check if client exists
    const existingClient = await db.query.clients.findFirst({
      where: eq(clients.id, id),
    });

    if (!existingClient) {
      return { success: false, error: 'Client not found' };
    }

    // Delete client (boards cascade via FK)
    await db.delete(clients).where(eq(clients.id, id));

    revalidatePath('/clients');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('deleteClient error:', error);
    return { success: false, error: 'Failed to delete client' };
  }
}
