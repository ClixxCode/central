'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  boards,
  favorites,
  savedViewInvitations,
  savedViewOwners,
  savedViewSources,
  savedViews,
  taskAssignees,
  tasks,
  teamMembers,
  users,
  type SavedViewFilters,
  type SavedViewPresentation,
} from '@/lib/db/schema';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import {
  createSavedViewSchema,
  updateSavedViewSchema,
  type CreateSavedViewInput,
  type UpdateSavedViewInput,
} from '@/lib/validations/saved-view';
import type { TaskFilters, TaskSortOptions } from './tasks';
import {
  getAvailableSourceBoards,
  getTasksForBoards,
  type RollupTaskWithAssignees,
} from './rollups';
import type { SectionOption, StatusOption } from '@/lib/db/schema';

export interface SavedViewSummary {
  id: string;
  name: string;
  sourceCount: number;
  isOwner: boolean;
  updatedAt: Date;
}

export interface SavedViewWithSources {
  id: string;
  name: string;
  filters: SavedViewFilters;
  presentation: SavedViewPresentation;
  reviewModeEnabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
  unavailableSourceCount: number;
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

export interface SavedViewTaskData {
  tasks: RollupTaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }[];
  resolvedFilters: TaskFilters;
  unavailableSourceCount: number;
}

type ActionResult<T = void> = { success: boolean; data?: T; error?: string };

async function isContractor(userId: string) {
  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  return memberships.some((membership) => membership.team.excludeFromPublic);
}

async function getAccessibleViewIds(userId: string): Promise<Set<string>> {
  const [owned, memberships, contractor] = await Promise.all([
    db.query.savedViewOwners.findMany({
      where: eq(savedViewOwners.userId, userId),
      columns: { viewId: true },
    }),
    db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, userId),
      columns: { teamId: true },
    }),
    isContractor(userId),
  ]);

  const inviteConditions = [eq(savedViewInvitations.userId, userId)];
  if (!contractor) inviteConditions.push(eq(savedViewInvitations.allUsers, true));
  if (memberships.length > 0) {
    inviteConditions.push(
      inArray(savedViewInvitations.teamId, memberships.map((membership) => membership.teamId))
    );
  }

  const invited = await db.query.savedViewInvitations.findMany({
    where: and(
      eq(savedViewInvitations.status, 'accepted'),
      or(...inviteConditions)
    ),
    columns: { viewId: true },
  });

  return new Set([...owned, ...invited].map((entry) => entry.viewId));
}

async function isViewOwner(viewId: string, userId: string) {
  return !!(await db.query.savedViewOwners.findFirst({
    where: and(eq(savedViewOwners.viewId, viewId), eq(savedViewOwners.userId, userId)),
    columns: { id: true },
  }));
}

async function getAccessibleBoardIds() {
  const result = await getAvailableSourceBoards();
  if (!result.success) throw new Error(result.error ?? 'Failed to load accessible boards');
  return new Set((result.data ?? []).map((board) => board.id));
}

async function validateSources(sourceBoardIds: string[]) {
  const accessible = await getAccessibleBoardIds();
  if (!sourceBoardIds.every((id) => accessible.has(id))) {
    throw new Error('One or more selected boards are unavailable');
  }
}

export async function listSavedViews(): Promise<ActionResult<SavedViewSummary[]>> {
  try {
    const user = await requireAuth();
    const accessibleIds = await getAccessibleViewIds(user.id);
    if (accessibleIds.size === 0) return { success: true, data: [] };

    const rows = await db.query.savedViews.findMany({
      where: inArray(savedViews.id, [...accessibleIds]),
      with: { sources: true, owners: true },
      orderBy: (view, { desc }) => [desc(view.updatedAt)],
    });
    return {
      success: true,
      data: rows.map((view) => ({
        id: view.id,
        name: view.name,
        sourceCount: view.sources.length,
        isOwner: view.owners.some((owner) => owner.userId === user.id),
        updatedAt: view.updatedAt,
      })),
    };
  } catch (error) {
    console.error('listSavedViews error:', error);
    return { success: false, error: 'Failed to list saved views' };
  }
}

export async function getSavedView(viewId: string): Promise<ActionResult<SavedViewWithSources | null>> {
  try {
    const user = await requireAuth();
    const accessibleIds = await getAccessibleViewIds(user.id);
    if (!accessibleIds.has(viewId)) return { success: true, data: null };

    const view = await db.query.savedViews.findFirst({
      where: eq(savedViews.id, viewId),
      with: {
        owners: true,
        sources: {
          with: {
            board: {
              with: {
                client: { columns: { id: true, name: true, slug: true, color: true, icon: true } },
              },
            },
          },
        },
      },
    });
    if (!view) return { success: true, data: null };

    const accessibleBoardIds = await getAccessibleBoardIds();
    const sources = view.sources.filter((source) => accessibleBoardIds.has(source.boardId));
    return {
      success: true,
      data: {
        id: view.id,
        name: view.name,
        filters: view.filters,
        presentation: view.presentation,
        reviewModeEnabled: view.reviewModeEnabled,
        createdBy: view.createdBy,
        createdAt: view.createdAt,
        updatedAt: view.updatedAt,
        canEdit: view.owners.some((owner) => owner.userId === user.id),
        unavailableSourceCount: view.sources.length - sources.length,
        sources: sources.map((source) => ({
          boardId: source.board.id,
          boardName: source.board.name,
          clientId: source.board.client?.id ?? null,
          clientName: source.board.client?.name ?? null,
          clientSlug: source.board.client?.slug ?? null,
          clientColor: source.board.client?.color ?? null,
          clientIcon: source.board.client?.icon ?? null,
        })),
      },
    };
  } catch (error) {
    console.error('getSavedView error:', error);
    return { success: false, error: 'Failed to load saved view' };
  }
}

export async function createSavedView(input: CreateSavedViewInput): Promise<ActionResult<SavedViewWithSources>> {
  try {
    const user = await requireAuth();
    const validation = createSavedViewSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.issues[0]?.message };
    await validateSources(validation.data.sourceBoardIds);

    const created = await db.transaction(async (tx) => {
      const [view] = await tx.insert(savedViews).values({
        name: validation.data.name,
        filters: validation.data.filters,
        presentation: validation.data.presentation,
        reviewModeEnabled: validation.data.reviewModeEnabled,
        createdBy: user.id,
      }).returning();
      await tx.insert(savedViewOwners).values({ viewId: view.id, userId: user.id, isPrimary: true });
      await tx.insert(savedViewSources).values(
        validation.data.sourceBoardIds.map((boardId) => ({ viewId: view.id, boardId }))
      );
      return view;
    });

    revalidatePath('/views');
    const result = await getSavedView(created.id);
    return result.data
      ? { success: true, data: result.data }
      : { success: false, error: 'View was created but could not be loaded' };
  } catch (error) {
    console.error('createSavedView error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create view' };
  }
}

export async function updateSavedView(
  viewId: string,
  input: UpdateSavedViewInput
): Promise<ActionResult<SavedViewWithSources>> {
  try {
    const user = await requireAuth();
    if (!(await isViewOwner(viewId, user.id))) return { success: false, error: 'Only owners can update this view' };
    const validation = updateSavedViewSchema.safeParse(input);
    if (!validation.success) return { success: false, error: validation.error.issues[0]?.message };
    if (validation.data.sourceBoardIds) await validateSources(validation.data.sourceBoardIds);

    await db.transaction(async (tx) => {
      await tx.update(savedViews).set({
        ...(validation.data.name !== undefined && { name: validation.data.name }),
        ...(validation.data.filters !== undefined && { filters: validation.data.filters }),
        ...(validation.data.presentation !== undefined && { presentation: validation.data.presentation }),
        ...(validation.data.reviewModeEnabled !== undefined && { reviewModeEnabled: validation.data.reviewModeEnabled }),
        updatedAt: new Date(),
      }).where(eq(savedViews.id, viewId));
      if (validation.data.sourceBoardIds) {
        await tx.delete(savedViewSources).where(eq(savedViewSources.viewId, viewId));
        await tx.insert(savedViewSources).values(
          validation.data.sourceBoardIds.map((boardId) => ({ viewId, boardId }))
        );
      }
    });

    revalidatePath('/views');
    revalidatePath(`/views/${viewId}`);
    const result = await getSavedView(viewId);
    return result.data
      ? { success: true, data: result.data }
      : { success: false, error: 'Updated view could not be loaded' };
  } catch (error) {
    console.error('updateSavedView error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update view' };
  }
}

export async function deleteSavedView(viewId: string): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (!(await isViewOwner(viewId, user.id))) return { success: false, error: 'Only owners can delete this view' };
    await db.transaction(async (tx) => {
      await tx.delete(favorites).where(eq(favorites.entityId, viewId));
      await tx.delete(savedViews).where(eq(savedViews.id, viewId));
    });
    revalidatePath('/views');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('deleteSavedView error:', error);
    return { success: false, error: 'Failed to delete view' };
  }
}

function semanticFiltersToTaskFilters(
  filters: SavedViewFilters,
  sourceBoards: { statusOptions: StatusOption[]; sectionOptions: SectionOption[] | null }[]
): TaskFilters {
  const statusIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const board of sourceBoards) {
    for (const status of board.statusOptions) {
      if (filters.statusLabels?.includes(status.label)) statusIds.add(status.id);
    }
    for (const section of board.sectionOptions ?? []) {
      if (filters.sectionLabels?.includes(section.label)) sectionIds.add(section.id);
    }
  }
  if (filters.includeNoSection) sectionIds.add('__none__');
  return {
    status: statusIds.size ? [...statusIds] : undefined,
    statusMode: statusIds.size ? filters.statusMode : undefined,
    section: sectionIds.size ? [...sectionIds] : undefined,
    sectionMode: sectionIds.size ? filters.sectionMode : undefined,
    assigneeId: filters.assigneeIds?.length ? filters.assigneeIds : undefined,
    assigneeMode: filters.assigneeIds?.length ? filters.assigneeMode : undefined,
    overdue: filters.overdue,
  };
}

async function getAssignableUsers(sourceBoardIds: string[]) {
  if (sourceBoardIds.length === 0) return [];
  const rows = await db.selectDistinct({
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
  })
    .from(taskAssignees)
    .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(tasks.boardId, sourceBoardIds));
  return rows.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

export async function previewSavedViewTasks(
  sourceBoardIds: string[],
  filters: TaskFilters = {},
  sort: TaskSortOptions = { field: 'position', direction: 'asc' }
): Promise<ActionResult<SavedViewTaskData>> {
  try {
    await requireAuth();
    await validateSources(sourceBoardIds);
    const [result, assignableUsers] = await Promise.all([
      getTasksForBoards(sourceBoardIds, filters, sort),
      getAssignableUsers(sourceBoardIds),
    ]);
    if (!result.success || !result.data) return { success: false, error: result.error };
    return {
      success: true,
      data: { ...result.data, assignableUsers, resolvedFilters: filters, unavailableSourceCount: 0 },
    };
  } catch (error) {
    console.error('previewSavedViewTasks error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to preview view' };
  }
}

export async function getSavedViewTasks(viewId: string): Promise<ActionResult<SavedViewTaskData>> {
  try {
    const viewResult = await getSavedView(viewId);
    if (!viewResult.success || !viewResult.data) return { success: false, error: 'View not found' };
    const view = viewResult.data;
    const boardIds = view.sources.map((source) => source.boardId);
    const sourceBoards = boardIds.length
      ? await db.query.boards.findMany({
          where: inArray(boards.id, boardIds),
          columns: { statusOptions: true, sectionOptions: true },
        })
      : [];
    const resolvedFilters = semanticFiltersToTaskFilters(view.filters, sourceBoards);
    const serverSort: TaskSortOptions = view.presentation.sort.field === 'client'
      ? { field: 'position', direction: view.presentation.sort.direction }
      : view.presentation.sort as TaskSortOptions;
    const [result, assignableUsers] = await Promise.all([
      getTasksForBoards(boardIds, resolvedFilters, serverSort),
      getAssignableUsers(boardIds),
    ]);
    if (!result.success || !result.data) return { success: false, error: result.error };
    return {
      success: true,
      data: {
        ...result.data,
        assignableUsers,
        resolvedFilters,
        unavailableSourceCount: view.unavailableSourceCount,
      },
    };
  } catch (error) {
    console.error('getSavedViewTasks error:', error);
    return { success: false, error: 'Failed to load view tasks' };
  }
}

export interface SavedViewInvitationDetails {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  teamId: string | null;
  teamName: string | null;
  allUsers: boolean;
  status: 'pending' | 'accepted' | 'declined';
}

export interface PendingSavedViewInvitation {
  id: string;
  viewId: string;
  viewName: string;
  target: 'user' | 'team';
}

export async function listPendingSavedViewInvitations(): Promise<ActionResult<PendingSavedViewInvitation[]>> {
  try {
    const user = await requireAuth();
    const memberships = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, user.id),
      columns: { teamId: true },
    });
    const targets = [eq(savedViewInvitations.userId, user.id)];
    if (memberships.length) {
      targets.push(inArray(savedViewInvitations.teamId, memberships.map((membership) => membership.teamId)));
    }
    const invitations = await db.query.savedViewInvitations.findMany({
      where: and(eq(savedViewInvitations.status, 'pending'), or(...targets)),
      with: { view: { columns: { id: true, name: true } } },
    });
    return { success: true, data: invitations.map((invitation) => ({
      id: invitation.id,
      viewId: invitation.view.id,
      viewName: invitation.view.name,
      target: invitation.teamId ? 'team' : 'user',
    })) };
  } catch (error) {
    console.error('listPendingSavedViewInvitations error:', error);
    return { success: false, error: 'Failed to load view invitations' };
  }
}

export async function getSavedViewInvitations(viewId: string): Promise<ActionResult<SavedViewInvitationDetails[]>> {
  try {
    const user = await requireAuth();
    if (!(await isViewOwner(viewId, user.id)) && user.role !== 'admin') {
      return { success: false, error: 'Only owners can manage sharing' };
    }
    const invitations = await db.query.savedViewInvitations.findMany({
      where: eq(savedViewInvitations.viewId, viewId),
      with: { user: true, team: true },
    });
    return { success: true, data: invitations.map((invite) => ({
      id: invite.id,
      userId: invite.userId,
      userName: invite.user?.name ?? null,
      userEmail: invite.user?.email ?? null,
      teamId: invite.teamId,
      teamName: invite.team?.name ?? null,
      allUsers: invite.allUsers,
      status: invite.status,
    })) };
  } catch (error) {
    console.error('getSavedViewInvitations error:', error);
    return { success: false, error: 'Failed to load sharing' };
  }
}

async function canManageSharing(viewId: string, userId: string, role: string) {
  return role === 'admin' || isViewOwner(viewId, userId);
}

export async function inviteUserToSavedView(viewId: string, userId: string): Promise<ActionResult> {
  try {
    const current = await requireAuth();
    if (!(await canManageSharing(viewId, current.id, current.role))) return { success: false, error: 'Only owners can manage sharing' };
    const existing = await db.query.savedViewInvitations.findFirst({
      where: and(eq(savedViewInvitations.viewId, viewId), eq(savedViewInvitations.userId, userId)),
    });
    if (existing) return { success: false, error: 'User already invited' };
    await db.insert(savedViewInvitations).values({
      viewId, userId, invitedBy: current.id,
      status: current.role === 'admin' ? 'accepted' : 'pending',
      respondedAt: current.role === 'admin' ? new Date() : null,
    });
    revalidatePath(`/views/${viewId}`);
    return { success: true };
  } catch (error) {
    console.error('inviteUserToSavedView error:', error);
    return { success: false, error: 'Failed to invite user' };
  }
}

export async function inviteTeamToSavedView(viewId: string, teamId: string): Promise<ActionResult> {
  try {
    const current = await requireAuth();
    if (!(await canManageSharing(viewId, current.id, current.role))) return { success: false, error: 'Only owners can manage sharing' };
    const existing = await db.query.savedViewInvitations.findFirst({
      where: and(eq(savedViewInvitations.viewId, viewId), eq(savedViewInvitations.teamId, teamId)),
    });
    if (existing) return { success: false, error: 'Team already invited' };
    await db.insert(savedViewInvitations).values({
      viewId, teamId, invitedBy: current.id,
      status: current.role === 'admin' ? 'accepted' : 'pending',
      respondedAt: current.role === 'admin' ? new Date() : null,
    });
    revalidatePath(`/views/${viewId}`);
    return { success: true };
  } catch (error) {
    console.error('inviteTeamToSavedView error:', error);
    return { success: false, error: 'Failed to invite team' };
  }
}

export async function inviteAllUsersToSavedView(viewId: string): Promise<ActionResult> {
  try {
    const current = await requireAdmin();
    const existing = await db.query.savedViewInvitations.findFirst({
      where: and(eq(savedViewInvitations.viewId, viewId), eq(savedViewInvitations.allUsers, true)),
    });
    if (existing) return { success: false, error: 'All users already invited' };
    await db.insert(savedViewInvitations).values({
      viewId, allUsers: true, invitedBy: current.id, status: 'accepted', respondedAt: new Date(),
    });
    revalidatePath(`/views/${viewId}`);
    return { success: true };
  } catch (error) {
    console.error('inviteAllUsersToSavedView error:', error);
    return { success: false, error: 'Failed to share with all users' };
  }
}

export async function removeSavedViewInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const current = await requireAuth();
    const invitation = await db.query.savedViewInvitations.findFirst({ where: eq(savedViewInvitations.id, invitationId) });
    if (!invitation) return { success: false, error: 'Invitation not found' };
    if (!(await canManageSharing(invitation.viewId, current.id, current.role))) return { success: false, error: 'Only owners can manage sharing' };
    await db.delete(savedViewInvitations).where(eq(savedViewInvitations.id, invitationId));
    revalidatePath(`/views/${invitation.viewId}`);
    return { success: true };
  } catch (error) {
    console.error('removeSavedViewInvitation error:', error);
    return { success: false, error: 'Failed to remove invitation' };
  }
}

export async function respondToSavedViewInvitation(invitationId: string, accept: boolean): Promise<ActionResult> {
  try {
    const current = await requireAuth();
    const invitation = await db.query.savedViewInvitations.findFirst({ where: eq(savedViewInvitations.id, invitationId) });
    if (!invitation || invitation.status !== 'pending') return { success: false, error: 'Invitation not found' };
    if (invitation.userId && invitation.userId !== current.id) return { success: false, error: 'This invitation is not for you' };
    if (invitation.teamId) {
      const membership = await db.query.teamMembers.findFirst({
        where: and(eq(teamMembers.teamId, invitation.teamId), eq(teamMembers.userId, current.id)),
      });
      if (!membership) return { success: false, error: 'This invitation is not for you' };
    }
    await db.update(savedViewInvitations).set({
      status: accept ? 'accepted' : 'declined', respondedAt: new Date(),
    }).where(eq(savedViewInvitations.id, invitationId));
    revalidatePath('/views');
    return { success: true };
  } catch (error) {
    console.error('respondToSavedViewInvitation error:', error);
    return { success: false, error: 'Failed to respond to invitation' };
  }
}
