import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton, taskCard } from './base';

export interface CommentAddedEmailData {
  recipientName: string;
  commenterName: string;
  taskTitle: string;
  taskId: string;
  boardId: string;
  clientSlug: string;
  commentPreview?: string;
  taskStatus: string;
  taskDueDate?: string;
}

export function commentAddedEmailSubject(commenterName: string, taskTitle: string): string {
  return `${commenterName} commented on "${taskTitle}"`;
}

export function commentAddedEmailHtml(data: CommentAddedEmailData): string {
  const taskUrl = `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  const commentHtml = data.commentPreview
    ? `<div style="background: #f3f4f6; border-left: 3px solid #8B5CF6; padding: 12px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #374151; font-style: italic;">"${data.commentPreview}"</p>
      </div>`
    : '';

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #111827;">New Comment</h2>
    <p style="margin: 0 0 16px; color: #374151;">
      <strong>${data.commenterName}</strong> added a comment on a task you're following:
    </p>
    ${commentHtml}
    ${taskCard({
      title: data.taskTitle,
      status: data.taskStatus,
      dueDate: data.taskDueDate,
    })}
    <div style="text-align: center; margin: 24px 0 8px;">
      ${emailButton('View Comment', taskUrl)}
    </div>
  `;

  return baseEmailTemplate(content, `${data.commenterName} commented on "${data.taskTitle}"`);
}
