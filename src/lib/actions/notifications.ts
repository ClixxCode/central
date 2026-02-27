'use server';

import { db } from '@/lib/db';
import {
  notifications,
  users,
  tasks,
  boards,
  clients,
  comments,
  taskAssignees,
  teams,
  teamMembers,
  boardAccess,
} from '@/lib/db/schema';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import { eq, and, isNull, desc, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { inngest } from '@/lib/inngest/client';
import { getPlainText } from '@/lib/editor/mentions';
import type { UserPreferences } from '@/lib/db/schema/users';
import type { CommentReactionType } from '@/lib/comments/reactions';

// Helper to get parent task title for subtask notifications
async function getParentTaskTitle(parentTaskId: string | null): Promise<string | null> {
  if (!parentTaskId) return null;
  const parent = await db.query.tasks.findFirst({
    where: eq(tasks.id, parentTaskId),
    columns: { title: true },
  });
  return parent?.title ?? null;
}

// Types
export type NotificationType =
  | 'mention'
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'comment_added'
  | 'reaction_added';

export interface NotificationWithTask {
  id: string;
  userId: string;
  type: NotificationType;
  taskId: string | null;
  commentId: string | null;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
  task: {
    id: string;
    title: string;
    boardId: string;
    board: {
      id: string;
      name: string;
      client: {
        id: string;
        name: string;
        slug: string;
      };
    };
  } | null;
}

// Type alias for backwards compatibility
export type NotificationWithContext = NotificationWithTask;

/**
 * List notifications for the current user
 */
export async function listNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<{
  success: boolean;
  notifications?: NotificationWithTask[];
  total?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const { limit = 50, unreadOnly = false } = options || {};

  const conditions = [eq(notifications.userId, user.id)];
  if (unreadOnly) {
    conditions.push(isNull(notifications.readAt));
  }

  const notificationList = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  // Get task details for notifications that have tasks
  const taskIds = notificationList
    .map((n) => n.taskId)
    .filter((id): id is string => id !== null);

  const taskDetails = taskIds.length > 0
    ? await db
        .select({
          id: tasks.id,
          title: tasks.title,
          boardId: tasks.boardId,
          boardName: boards.name,
          clientId: clients.id,
          clientName: clients.name,
          clientSlug: clients.slug,
        })
        .from(tasks)
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .innerJoin(clients, eq(clients.id, boards.clientId))
        .where(inArray(tasks.id, taskIds))
    : [];

  const taskMap = new Map(taskDetails.map((t) => [t.id, {
    id: t.id,
    title: t.title,
    boardId: t.boardId,
    board: {
      id: t.boardId,
      name: t.boardName,
      client: {
        id: t.clientId,
        name: t.clientName,
        slug: t.clientSlug,
      },
    },
  }]));

  const result: NotificationWithTask[] = notificationList.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    taskId: n.taskId,
    commentId: n.commentId,
    title: n.title,
    body: n.body,
    readAt: n.readAt,
    createdAt: n.createdAt,
    task: n.taskId ? taskMap.get(n.taskId) || null : null,
  }));

  return { success: true, notifications: result, total: notificationList.length };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const user = await requireAuth();

  const unreadNotifications = await db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, user.id),
      isNull(notifications.readAt)
    ),
    columns: { id: true },
  });

  return { success: true, count: unreadNotifications.length };
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  const notification = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, user.id)
    ),
  });

  if (!notification) {
    return { success: false, error: 'Notification not found' };
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, notificationId));

  return { success: true };
}

/**
 * Mark a notification as unread
 */
export async function markAsUnread(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  const notification = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, user.id)
    ),
  });

  if (!notification) {
    return { success: false, error: 'Notification not found' };
  }

  await db
    .update(notifications)
    .set({ readAt: null })
    .where(eq(notifications.id, notificationId));

  return { success: true };
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const user = await requireAuth();

  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id });

  return { success: true, count: result.length };
}

/**
 * Mark notifications by type as read
 */
export async function markNotificationsByTypeAsRead(
  type: 'mention' | 'comment_added' | 'reaction_added'
): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const user = await requireAuth();

  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.type, type),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id });

  return { success: true, count: result.length };
}

function formatReactionLabel(reaction: CommentReactionType): string {
  return reaction
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Create an in-app notification when someone reacts to your comment.
 */
export async function createReactionNotification(input: {
  reactorUserId: string;
  commentId: string;
  reaction: CommentReactionType;
}): Promise<{ success: boolean; notificationId?: string }> {
  const reactor = await db.query.users.findFirst({
    where: eq(users.id, input.reactorUserId),
    columns: { name: true, email: true },
  });

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, input.commentId),
    columns: { id: true, taskId: true, authorId: true },
  });

  if (!reactor || !comment || !comment.authorId) {
    return { success: false };
  }

  if (comment.authorId === input.reactorUserId) {
    return { success: true };
  }

  const recipient = await db.query.users.findFirst({
    where: eq(users.id, comment.authorId),
    columns: { id: true, deactivatedAt: true, preferences: true },
  });

  if (!recipient || recipient.deactivatedAt) {
    return { success: false };
  }

  const prefs = recipient.preferences as UserPreferences | null;
  if (prefs?.notifications?.inApp?.enabled === false) {
    return { success: true };
  }
  if (prefs?.notifications?.inApp?.reactions === false) {
    return { success: true };
  }

  const taskDetails = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      parentTaskId: tasks.parentTaskId,
    })
    .from(tasks)
    .where(eq(tasks.id, comment.taskId))
    .limit(1);

  const task = taskDetails[0];
  if (!task) {
    return { success: false };
  }

  const parentTitle = await getParentTaskTitle(task.parentTaskId);
  const reactorName = reactor.name || reactor.email;
  const taskLabel = parentTitle ? `"${task.title}" (subtask of "${parentTitle}")` : `"${task.title}"`;
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: recipient.id,
      type: 'reaction_added',
      taskId: task.id,
      commentId: comment.id,
      title: `${reactorName} reacted to your comment on ${taskLabel}`,
      body: formatReactionLabel(input.reaction),
    })
    .returning();

  return { success: true, notificationId: notification.id };
}

/**
 * Create a mention notification and trigger email
 */
export async function createMentionNotification(input: {
  mentionedUserId: string;
  mentionerUserId: string;
  taskId: string;
  commentId: string;
  commentContent: TiptapContent;
}): Promise<{ success: boolean; notificationId?: string }> {
  // Get mentioner details
  const mentioner = await db.query.users.findFirst({
    where: eq(users.id, input.mentionerUserId),
    columns: { name: true, email: true },
  });

  // Get mentioned user details
  const mentionedUser = await db.query.users.findFirst({
    where: eq(users.id, input.mentionedUserId),
    columns: { id: true, name: true, email: true, deactivatedAt: true },
  });

  if (!mentioner || !mentionedUser) {
    return { success: false };
  }

  // Skip notifications for deactivated users
  if (mentionedUser.deactivatedAt) {
    return { success: false };
  }

  // Get task with board and client details
  const taskDetails = await db
    .select({
      id: tasks.id,
      shortId: tasks.shortId,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      parentTaskId: tasks.parentTaskId,
      boardId: boards.id,
      boardName: boards.name,
      clientSlug: clients.slug,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(eq(tasks.id, input.taskId))
    .limit(1);

  const task = taskDetails[0];
  if (!task) {
    return { success: false };
  }

  const parentTitle = await getParentTaskTitle(task.parentTaskId);

  // Check if mentioned user has access to the board
  // Non-contractors have access to all boards; contractors need explicit access
  const mentionedUserTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, input.mentionedUserId),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  const isContractor = mentionedUserTeams.some((tm) => tm.team.excludeFromPublic);

  if (isContractor) {
    // Check for explicit board access (direct or via team)
    const userTeamIds = mentionedUserTeams.map((tm) => tm.teamId);
    const hasDirectAccess = await db.query.boardAccess.findFirst({
      where: and(
        eq(boardAccess.boardId, task.boardId),
        eq(boardAccess.userId, input.mentionedUserId)
      ),
    });
    const hasTeamAccess = userTeamIds.length > 0
      ? await db.query.boardAccess.findFirst({
          where: and(
            eq(boardAccess.boardId, task.boardId),
            inArray(boardAccess.teamId, userTeamIds)
          ),
        })
      : null;

    if (!hasDirectAccess && !hasTeamAccess) {
      // Contractor doesn't have board access — skip notification
      return { success: false };
    }
  }

  const mentionerName = mentioner.name || mentioner.email;
  const commentPreview = getPlainText(input.commentContent).slice(0, 100);

  // Create the notification
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.mentionedUserId,
      type: 'mention',
      taskId: input.taskId,
      commentId: input.commentId,
      title: parentTitle
        ? `${mentionerName} mentioned you in "${task.title}" (subtask of "${parentTitle}")`
        : `${mentionerName} mentioned you in "${task.title}"`,
      body: commentPreview,
    })
    .returning();

  // Trigger email via Inngest
  await inngest.send({
    name: 'notification/mention.created',
    data: {
      notificationId: notification.id,
      recipientId: mentionedUser.id,
      recipientEmail: mentionedUser.email,
      recipientName: mentionedUser.name,
      mentionerName,
      taskId: task.id,
      taskShortId: task.shortId,
      taskTitle: task.title,
      taskStatus: task.status,
      taskDueDate: task.dueDate,
      boardId: task.boardId,
      clientSlug: task.clientSlug,
      commentId: input.commentId,
      commentPreview,
    },
  });

  return { success: true, notificationId: notification.id };
}

/**
 * Create comment_added notifications for:
 * - Task assignees
 * - Previous commenters on the same task
 * - Users mentioned in previous comments on the same task
 */
export async function createCommentAddedNotification(input: {
  commenterId: string;
  taskId: string;
  commentId: string;
  commentContent: TiptapContent;
  excludeUserIds?: string[];
  /** If this is a reply, the parent comment's author ID (gets "replied to your comment" title) */
  parentCommentAuthorId?: string;
}): Promise<{ success: boolean; notificationIds?: string[] }> {
  const { extractMentionedUserIds } = await import('@/lib/editor/mentions');

  // Get commenter details
  const commenter = await db.query.users.findFirst({
    where: eq(users.id, input.commenterId),
    columns: { id: true, name: true, email: true },
  });

  if (!commenter) {
    return { success: false };
  }

  // Get task with board and client details
  const taskDetails = await db
    .select({
      id: tasks.id,
      shortId: tasks.shortId,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      parentTaskId: tasks.parentTaskId,
      boardId: boards.id,
      boardName: boards.name,
      clientSlug: clients.slug,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(eq(tasks.id, input.taskId))
    .limit(1);

  const task = taskDetails[0];
  if (!task) {
    return { success: false };
  }

  const parentTitle = await getParentTaskTitle(task.parentTaskId);

  // Collect all users who should be notified (using Set to avoid duplicates)
  const recipientIds = new Set<string>();

  // 1. Get task assignees
  const assignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, input.taskId));

  for (const assignee of assignees) {
    recipientIds.add(assignee.userId);
  }

  // 2. Get previous commenters on this task
  const previousComments = await db.query.comments.findMany({
    where: eq(comments.taskId, input.taskId),
    columns: { id: true, authorId: true, content: true },
  });

  for (const comment of previousComments) {
    // Add the commenter (skip if author was deleted)
    if (comment.authorId) recipientIds.add(comment.authorId);

    // 3. Extract users mentioned in previous comments
    const mentionedInComment = extractMentionedUserIds(comment.content as TiptapContent);
    for (const mentionedUserId of mentionedInComment) {
      recipientIds.add(mentionedUserId);
    }
  }

  // Remove the commenter themselves (don't notify yourself)
  recipientIds.delete(input.commenterId);

  // Remove users who already received a mention notification for this comment
  if (input.excludeUserIds) {
    for (const userId of input.excludeUserIds) {
      recipientIds.delete(userId);
    }
  }

  if (recipientIds.size === 0) {
    return { success: true, notificationIds: [] };
  }

  // Remove users who already have a recent unread notification for this task
  // (e.g. they were @mentioned in another comment moments ago — no need to also send "commented on")
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentNotifications = await db
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        eq(notifications.taskId, input.taskId),
        inArray(notifications.userId, [...recipientIds]),
        isNull(notifications.readAt),
        sql`${notifications.createdAt} > ${tenMinutesAgo}`
      )
    );

  for (const existing of recentNotifications) {
    recipientIds.delete(existing.userId);
  }

  if (recipientIds.size === 0) {
    return { success: true, notificationIds: [] };
  }

  // Filter out deactivated users
  const recipientUsers = recipientIds.size > 0
    ? await db
        .select({ id: users.id, email: users.email, name: users.name, deactivatedAt: users.deactivatedAt })
        .from(users)
        .where(inArray(users.id, [...recipientIds]))
    : [];

  const activeRecipients = recipientUsers.filter((u) => !u.deactivatedAt);

  if (activeRecipients.length === 0) {
    return { success: true, notificationIds: [] };
  }

  const commenterName = commenter.name || commenter.email;
  const commentPreview = getPlainText(input.commentContent).slice(0, 100);

  // Create notifications for all active recipients
  const notificationIds: string[] = [];

  for (const recipient of activeRecipients) {
    const recipientId = recipient.id;
    // Customize title for parent comment author when this is a reply
    const taskLabel = parentTitle ? `"${task.title}" (subtask of "${parentTitle}")` : `"${task.title}"`;
    const title = input.parentCommentAuthorId && recipientId === input.parentCommentAuthorId
      ? `${commenterName} replied to your comment on ${taskLabel}`
      : `${commenterName} commented on ${taskLabel}`;

    const [notification] = await db
      .insert(notifications)
      .values({
        userId: recipientId,
        type: 'comment_added',
        taskId: input.taskId,
        commentId: input.commentId,
        title,
        body: commentPreview,
      })
      .returning();

    notificationIds.push(notification.id);

    if (recipient) {
      // Trigger notification via Inngest (email/Slack based on preferences)
      await inngest.send({
        name: 'notification/comment.added',
        data: {
          notificationId: notification.id,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          commenterName,
          taskId: task.id,
          taskShortId: task.shortId,
          taskTitle: task.title,
          taskStatus: task.status,
          taskDueDate: task.dueDate,
          boardId: task.boardId,
          clientSlug: task.clientSlug,
          commentId: input.commentId,
          commentPreview,
        },
      });
    }
  }

  return { success: true, notificationIds };
}

/**
 * Create assignment notification and trigger email
 */
export async function createAssignmentNotification(input: {
  assigneeUserId: string;
  assignerUserId: string;
  taskId: string;
}): Promise<{ success: boolean; notificationId?: string }> {
  // Don't notify if assigning to self
  if (input.assigneeUserId === input.assignerUserId) {
    return { success: true };
  }

  // Get assigner details
  const assigner = await db.query.users.findFirst({
    where: eq(users.id, input.assignerUserId),
    columns: { name: true, email: true },
  });

  // Get assignee details
  const assignee = await db.query.users.findFirst({
    where: eq(users.id, input.assigneeUserId),
    columns: { id: true, name: true, email: true, deactivatedAt: true },
  });

  if (!assigner || !assignee) {
    return { success: false };
  }

  // Skip notifications for deactivated users
  if (assignee.deactivatedAt) {
    return { success: false };
  }

  // Get task with board and client details
  const taskDetails = await db
    .select({
      id: tasks.id,
      shortId: tasks.shortId,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      description: tasks.description,
      parentTaskId: tasks.parentTaskId,
      boardId: boards.id,
      boardName: boards.name,
      clientSlug: clients.slug,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(eq(tasks.id, input.taskId))
    .limit(1);

  const task = taskDetails[0];
  if (!task) {
    return { success: false };
  }

  const parentTitle = await getParentTaskTitle(task.parentTaskId);
  const assignerName = assigner.name || assigner.email;
  const taskDescription = task.description
    ? getPlainText(task.description).slice(0, 200)
    : null;

  // Create the notification
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.assigneeUserId,
      type: 'task_assigned',
      taskId: input.taskId,
      title: parentTitle
        ? `${assignerName} assigned you to "${task.title}" (subtask of "${parentTitle}")`
        : `${assignerName} assigned you to "${task.title}"`,
      body: taskDescription,
    })
    .returning();

  // Trigger email via Inngest
  await inngest.send({
    name: 'notification/assignment.created',
    data: {
      notificationId: notification.id,
      recipientId: assignee.id,
      recipientEmail: assignee.email,
      recipientName: assignee.name,
      assignerName,
      taskId: task.id,
      taskShortId: task.shortId,
      taskTitle: task.title,
      taskStatus: task.status,
      taskDueDate: task.dueDate,
      taskDescription,
      boardId: task.boardId,
      boardName: task.boardName,
      clientSlug: task.clientSlug,
      clientName: task.clientName,
    },
  });

  return { success: true, notificationId: notification.id };
}

/**
 * Create due date notification and trigger email
 */
export async function createDueNotification(input: {
  userId: string;
  taskId: string;
  isOverdue: boolean;
}): Promise<{ success: boolean; notificationId?: string }> {
  // Get user details
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true, name: true, email: true, deactivatedAt: true },
  });

  if (!user) {
    return { success: false };
  }

  // Skip notifications for deactivated users
  if (user.deactivatedAt) {
    return { success: false };
  }

  // Get task with board and client details
  const taskDetails = await db
    .select({
      id: tasks.id,
      shortId: tasks.shortId,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      parentTaskId: tasks.parentTaskId,
      boardId: boards.id,
      boardName: boards.name,
      clientSlug: clients.slug,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(eq(tasks.id, input.taskId))
    .limit(1);

  const task = taskDetails[0];
  if (!task || !task.dueDate) {
    return { success: false };
  }

  const parentTitle = await getParentTaskTitle(task.parentTaskId);
  const notificationType = input.isOverdue ? 'task_overdue' : 'task_due_soon';
  const taskLabel = parentTitle ? `"${task.title}" (subtask of "${parentTitle}")` : `"${task.title}"`;
  const title = input.isOverdue
    ? `${taskLabel} is overdue`
    : `${taskLabel} is due soon`;

  // Create the notification
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: notificationType,
      taskId: input.taskId,
      title,
      body: `Due: ${task.dueDate}`,
    })
    .returning();

  // Trigger email via Inngest
  await inngest.send({
    name: 'notification/due-reminder.scheduled',
    data: {
      notificationId: notification.id,
      recipientId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      taskId: task.id,
      taskShortId: task.shortId,
      taskTitle: task.title,
      taskStatus: task.status,
      dueDate: task.dueDate,
      isOverdue: input.isOverdue,
      boardId: task.boardId,
      boardName: task.boardName,
      clientSlug: task.clientSlug,
      clientName: task.clientName,
    },
  });

  return { success: true, notificationId: notification.id };
}

/**
 * Trigger daily digest for a user
 */
export async function triggerDailyDigest(userId: string): Promise<{
  success: boolean;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, name: true },
  });

  if (!user) {
    return { success: false };
  }

  await inngest.send({
    name: 'notification/daily-digest.scheduled',
    data: {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
    },
  });

  return { success: true };
}

/**
 * Clear all read notifications for the current user
 */
export async function clearReadNotifications(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();

  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        sql`${notifications.readAt} IS NOT NULL`
      )
    )
    .returning({ id: notifications.id });

  return { success: true, deletedCount: result.length };
}

/**
 * Delete a single notification
 */
export async function deleteNotification(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id)
      )
    );

  return { success: true };
}

// Function aliases for backwards compatibility
export const getUnreadNotificationCount = getUnreadCount;
export const markNotificationAsRead = markAsRead;
export const markNotificationAsUnread = markAsUnread;
export const markAllNotificationsAsRead = markAllAsRead;

/**
 * List mentions for the current user (notifications where user is @mentioned)
 */
export async function listMentions(options?: {
  limit?: number;
}): Promise<{
  success: boolean;
  notifications?: NotificationWithTask[];
  error?: string;
}> {
  const user = await requireAuth();
  const { limit = 50 } = options || {};

  const mentionsList = await db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, user.id),
      eq(notifications.type, 'mention')
    ),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  // Get task details for mentions that have tasks
  const taskIds = mentionsList
    .map((n) => n.taskId)
    .filter((id): id is string => id !== null);

  const taskDetails = taskIds.length > 0
    ? await db
        .select({
          id: tasks.id,
          title: tasks.title,
          boardId: tasks.boardId,
          boardName: boards.name,
          clientId: clients.id,
          clientName: clients.name,
          clientSlug: clients.slug,
        })
        .from(tasks)
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .innerJoin(clients, eq(clients.id, boards.clientId))
        .where(inArray(tasks.id, taskIds))
    : [];

  const taskMap = new Map(taskDetails.map((t) => [t.id, {
    id: t.id,
    title: t.title,
    boardId: t.boardId,
    board: {
      id: t.boardId,
      name: t.boardName,
      client: {
        id: t.clientId,
        name: t.clientName,
        slug: t.clientSlug,
      },
    },
  }]));

  const result: NotificationWithTask[] = mentionsList.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type as NotificationType,
    taskId: n.taskId,
    commentId: n.commentId,
    title: n.title,
    body: n.body,
    readAt: n.readAt,
    createdAt: n.createdAt,
    task: n.taskId ? taskMap.get(n.taskId) || null : null,
  }));

  return { success: true, notifications: result };
}

/**
 * List replies on comments the user created
 * These are comment_added notifications where the comment is on a task
 * where the user has previously commented
 */
export async function listReplies(options?: {
  limit?: number;
}): Promise<{
  success: boolean;
  notifications?: NotificationWithTask[];
  error?: string;
}> {
  const user = await requireAuth();
  const { limit = 50 } = options || {};

  // Get comment_added notifications for the user
  // These represent replies on tasks where the user is involved
  const repliesList = await db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, user.id),
      eq(notifications.type, 'comment_added')
    ),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });

  // Get task details for replies that have tasks
  const taskIds = repliesList
    .map((n) => n.taskId)
    .filter((id): id is string => id !== null);

  const taskDetails = taskIds.length > 0
    ? await db
        .select({
          id: tasks.id,
          title: tasks.title,
          boardId: tasks.boardId,
          boardName: boards.name,
          clientId: clients.id,
          clientName: clients.name,
          clientSlug: clients.slug,
        })
        .from(tasks)
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .innerJoin(clients, eq(clients.id, boards.clientId))
        .where(inArray(tasks.id, taskIds))
    : [];

  const taskMap = new Map(taskDetails.map((t) => [t.id, {
    id: t.id,
    title: t.title,
    boardId: t.boardId,
    board: {
      id: t.boardId,
      name: t.boardName,
      client: {
        id: t.clientId,
        name: t.clientName,
        slug: t.clientSlug,
      },
    },
  }]));

  const result: NotificationWithTask[] = repliesList.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type as NotificationType,
    taskId: n.taskId,
    commentId: n.commentId,
    title: n.title,
    body: n.body,
    readAt: n.readAt,
    createdAt: n.createdAt,
    task: n.taskId ? taskMap.get(n.taskId) || null : null,
  }));

  return { success: true, notifications: result };
}
