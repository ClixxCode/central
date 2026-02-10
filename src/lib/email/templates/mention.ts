import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton, taskCard } from './base';

export interface MentionEmailData {
  recipientName: string;
  mentionerName: string;
  taskTitle: string;
  taskId: string;
  boardId: string;
  clientSlug: string;
  commentPreview?: string;
  taskStatus: string;
  taskDueDate?: string;
}

export function mentionEmailSubject(mentionerName: string, taskTitle: string): string {
  return `${mentionerName} mentioned you in "${taskTitle}"`;
}

export function mentionEmailHtml(data: MentionEmailData): string {
  const taskUrl = `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  const commentHtml = data.commentPreview
    ? `<div style="background: #353145; border-left: 3px solid #7c8fff; padding: 12px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #d1cdd9; font-style: italic;">"${data.commentPreview}"</p>
      </div>`
    : '';

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #f5f5f5;">You were mentioned</h2>
    <p style="margin: 0 0 16px; color: #d1cdd9;">
      <strong>${data.mentionerName}</strong> mentioned you in a comment on the following task:
    </p>
    ${commentHtml}
    ${taskCard({
      title: data.taskTitle,
      status: data.taskStatus,
      dueDate: data.taskDueDate,
    })}
    <div style="text-align: center; margin: 24px 0 8px;">
      ${emailButton('View Task', taskUrl)}
    </div>
  `;

  return baseEmailTemplate(content, `${data.mentionerName} mentioned you in "${data.taskTitle}"`);
}
