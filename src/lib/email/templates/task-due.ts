import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton, taskCard, formatEmailDate } from './base';

export interface TaskDueEmailData {
  recipientName: string;
  taskTitle: string;
  taskId: string;
  boardId: string;
  clientSlug: string;
  clientName: string;
  boardName: string;
  taskStatus: string;
  dueDate: string;
  isOverdue: boolean;
}

export function taskDueSoonEmailSubject(taskTitle: string): string {
  return `Reminder: "${taskTitle}" is due soon`;
}

export function taskOverdueEmailSubject(taskTitle: string): string {
  return `Overdue: "${taskTitle}" was due`;
}

export function taskDueEmailHtml(data: TaskDueEmailData): string {
  const taskUrl = `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;
  const formattedDate = formatEmailDate(data.dueDate);

  const headerStyle = data.isOverdue
    ? 'color: #DC2626;' // red for overdue
    : 'color: #D97706;'; // amber for due soon

  const headerText = data.isOverdue
    ? 'Task Overdue'
    : 'Task Due Soon';

  const messageText = data.isOverdue
    ? `This task was due on <strong>${formattedDate}</strong> and needs your attention.`
    : `This task is due on <strong>${formattedDate}</strong>. Don't forget to complete it!`;

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 18px; ${headerStyle}">${headerText}</h2>
    <p style="margin: 0 0 16px; color: #374151;">
      ${messageText}
    </p>
    ${taskCard({
      title: data.taskTitle,
      status: data.taskStatus,
      dueDate: formattedDate,
      clientName: data.clientName,
      boardName: data.boardName,
    })}
    <div style="text-align: center; margin: 24px 0 8px;">
      ${emailButton('View Task', taskUrl)}
    </div>
  `;

  const preheader = data.isOverdue
    ? `"${data.taskTitle}" is overdue`
    : `"${data.taskTitle}" is due ${formattedDate}`;

  return baseEmailTemplate(content, preheader);
}
