import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton, taskCard } from './base';

export interface TaskAssignedEmailData {
  recipientName: string;
  assignerName: string;
  taskTitle: string;
  taskId: string;
  boardId: string;
  clientSlug: string;
  clientName: string;
  boardName: string;
  taskStatus: string;
  taskDueDate?: string;
  taskDescription?: string;
}

export function taskAssignedEmailSubject(taskTitle: string): string {
  return `You've been assigned to "${taskTitle}"`;
}

export function taskAssignedEmailHtml(data: TaskAssignedEmailData): string {
  const taskUrl = `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  const descriptionHtml = data.taskDescription
    ? `<p style="margin: 16px 0; color: #a0a0a8; font-size: 14px;">${data.taskDescription}</p>`
    : '';

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #f5f5f5;">New Task Assignment</h2>
    <p style="margin: 0 0 16px; color: #d0d0d5;">
      <strong>${data.assignerName}</strong> assigned you to a task:
    </p>
    ${taskCard({
      title: data.taskTitle,
      status: data.taskStatus,
      dueDate: data.taskDueDate,
      clientName: data.clientName,
      boardName: data.boardName,
    })}
    ${descriptionHtml}
    <div style="text-align: center; margin: 24px 0 8px;">
      ${emailButton('View Task', taskUrl)}
    </div>
  `;

  return baseEmailTemplate(content, `${data.assignerName} assigned you to "${data.taskTitle}"`);
}
