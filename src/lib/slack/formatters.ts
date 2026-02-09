/**
 * Slack Message Formatters
 *
 * Creates formatted Slack messages for different notification types.
 * Uses Slack Block Kit for rich, interactive messages.
 */

import type { SlackMessage, SlackBlock } from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface NotificationContext {
  taskId?: string;
  taskTitle?: string;
  boardId?: string;
  boardName?: string;
  clientSlug?: string;
  clientName?: string;
  actorName?: string;
  actorEmail?: string;
  dueDate?: string;
  commentPreview?: string;
  commentId?: string;
}

/**
 * Build a task URL for linking in Slack messages
 */
function getTaskUrl(context: NotificationContext): string | null {
  if (!context.clientSlug || !context.boardId || !context.taskId) {
    return null;
  }
  const url = `${APP_URL}/clients/${context.clientSlug}/boards/${context.boardId}?task=${context.taskId}`;
  if (context.commentId) {
    return `${url}&comment=${context.commentId}`;
  }
  return url;
}

/**
 * Build a board URL for linking in Slack messages
 */
function getBoardUrl(context: NotificationContext): string | null {
  if (!context.clientSlug || !context.boardId) {
    return null;
  }
  return `${APP_URL}/clients/${context.clientSlug}/boards/${context.boardId}`;
}

/**
 * Build a consistent notification layout:
 *   1. Bold title (action + task name in one sentence)
 *   2. "View Task" button
 *   3. Comment preview (if applicable)
 *   4. Board link (Client › Board)
 */
function buildNotificationBlocks(options: {
  title: string;
  taskUrl: string | null;
  boardUrl: string | null;
  clientName?: string;
  boardName?: string;
  dueDate?: string;
  isOverdue?: boolean;
  commentPreview?: string;
}): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Bold title
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: options.title,
    },
  });

  // CTA button
  if (options.taskUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Task',
          },
          url: options.taskUrl,
          action_id: 'view_task',
        },
      ],
    } as SlackBlock);
  }

  // Comment preview
  if (options.commentPreview) {
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: escapeSlackText(truncateText(options.commentPreview, 200)),
      }],
    } as SlackBlock);
  }

  // Board link
  if (options.clientName) {
    const label = options.boardName
      ? `${escapeSlackText(options.clientName)} › ${escapeSlackText(options.boardName)}`
      : escapeSlackText(options.clientName);
    const locationText = options.boardUrl
      ? `<${options.boardUrl}|${label}>`
      : label;

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: locationText }],
    } as SlackBlock);
  }

  // Due date (for assignments)
  if (options.dueDate) {
    const dueDateFormatted = formatDate(options.dueDate);
    const dateText = options.isOverdue
      ? `~${dueDateFormatted}~ (overdue)`
      : `Due ${dueDateFormatted}`;

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: dateText }],
    } as SlackBlock);
  }

  return blocks;
}

/**
 * Format a mention notification for Slack
 */
export function formatMentionNotification(context: NotificationContext): SlackMessage {
  const taskUrl = getTaskUrl(context);
  const boardUrl = getBoardUrl(context);
  const actor = context.actorName || context.actorEmail || 'Someone';
  const task = context.taskTitle || 'a task';
  const taskDisplay = taskUrl
    ? `<${taskUrl}|${escapeSlackText(task)}>`
    : `"${escapeSlackText(task)}"`;

  const blocks = buildNotificationBlocks({
    title: `*${escapeSlackText(actor)} mentioned you in ${taskDisplay}*`,
    taskUrl,
    boardUrl,
    clientName: context.clientName,
    boardName: context.boardName,
    commentPreview: context.commentPreview,
  });

  return {
    text: `${actor} mentioned you in "${task}"`,
    blocks,
  };
}

/**
 * Format a task assignment notification for Slack
 */
export function formatTaskAssignedNotification(context: NotificationContext): SlackMessage {
  const taskUrl = getTaskUrl(context);
  const boardUrl = getBoardUrl(context);
  const actor = context.actorName || context.actorEmail || 'Someone';
  const task = context.taskTitle || 'a task';
  const taskDisplay = taskUrl
    ? `<${taskUrl}|${escapeSlackText(task)}>`
    : `"${escapeSlackText(task)}"`;

  const blocks = buildNotificationBlocks({
    title: `*${escapeSlackText(actor)} assigned you ${taskDisplay}*`,
    taskUrl,
    boardUrl,
    clientName: context.clientName,
    boardName: context.boardName,
    dueDate: context.dueDate,
  });

  return {
    text: `${actor} assigned you "${task}"`,
    blocks,
  };
}

/**
 * Format a due date reminder notification for Slack
 */
export function formatDueDateReminderNotification(
  context: NotificationContext,
  reminderType: 'due_soon' | 'overdue'
): SlackMessage {
  const taskUrl = getTaskUrl(context);
  const boardUrl = getBoardUrl(context);
  const isOverdue = reminderType === 'overdue';
  const task = context.taskTitle || 'Untitled';
  const taskDisplay = taskUrl
    ? `<${taskUrl}|${escapeSlackText(task)}>`
    : `"${escapeSlackText(task)}"`;

  const verb = isOverdue ? 'is overdue' : 'is due soon';

  const blocks = buildNotificationBlocks({
    title: `*Your task ${taskDisplay} ${verb}*`,
    taskUrl,
    boardUrl,
    clientName: context.clientName,
    boardName: context.boardName,
    dueDate: context.dueDate,
    isOverdue,
  });

  const fallbackText = isOverdue
    ? `Your task "${task}" is overdue!`
    : `Your task "${task}" is due soon`;

  return {
    text: fallbackText,
    blocks,
  };
}

/**
 * Format a comment added notification for Slack
 */
export function formatCommentAddedNotification(context: NotificationContext): SlackMessage {
  const taskUrl = getTaskUrl(context);
  const boardUrl = getBoardUrl(context);
  const actor = context.actorName || context.actorEmail || 'Someone';
  const task = context.taskTitle || 'a task';
  const taskDisplay = taskUrl
    ? `<${taskUrl}|${escapeSlackText(task)}>`
    : `"${escapeSlackText(task)}"`;

  const blocks = buildNotificationBlocks({
    title: `*${escapeSlackText(actor)} commented on ${taskDisplay}*`,
    taskUrl,
    boardUrl,
    clientName: context.clientName,
    boardName: context.boardName,
    commentPreview: context.commentPreview,
  });

  return {
    text: `${actor} commented on "${task}"`,
    blocks,
  };
}

// Helper functions

/**
 * Escape special characters for Slack mrkdwn format
 */
function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}
