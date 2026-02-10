import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton, taskCard, formatEmailDate } from './base';

export interface DigestTask {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  clientName: string;
  boardName: string;
  boardId: string;
  clientSlug: string;
}

export interface DigestNotification {
  type: 'mention' | 'task_assigned' | 'comment_added';
  actorName: string;
  taskTitle: string;
  taskId: string;
  boardId: string;
  clientSlug: string;
  createdAt: Date | string;
}

export interface DailyDigestEmailData {
  recipientName: string;
  date: Date;
  tasksDueToday: DigestTask[];
  tasksDueTomorrow: DigestTask[];
  tasksOverdue: DigestTask[];
  unreadNotifications: DigestNotification[];
}

export function dailyDigestEmailSubject(date: Date): string {
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return `Your Daily Digest - ${formatted}`;
}

export function dailyDigestEmailHtml(data: DailyDigestEmailData): string {
  const myTasksUrl = `${getAppUrl()}/my-tasks`;
  const sections: string[] = [];

  // Overdue tasks section
  if (data.tasksOverdue.length > 0) {
    const tasksHtml = data.tasksOverdue
      .map((task) => taskCard({
        title: task.title,
        status: task.status,
        dueDate: task.dueDate ? formatEmailDate(task.dueDate) : undefined,
        clientName: task.clientName,
        boardName: task.boardName,
      }))
      .join('');

    sections.push(`
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #f87171; border-bottom: 2px solid #5c2b2b; padding-bottom: 8px;">
          Overdue (${data.tasksOverdue.length})
        </h3>
        ${tasksHtml}
      </div>
    `);
  }

  // Due today section
  if (data.tasksDueToday.length > 0) {
    const tasksHtml = data.tasksDueToday
      .map((task) => taskCard({
        title: task.title,
        status: task.status,
        dueDate: 'Today',
        clientName: task.clientName,
        boardName: task.boardName,
      }))
      .join('');

    sections.push(`
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #fbbf24; border-bottom: 2px solid #5c4a1e; padding-bottom: 8px;">
          Due Today (${data.tasksDueToday.length})
        </h3>
        ${tasksHtml}
      </div>
    `);
  }

  // Due tomorrow section
  if (data.tasksDueTomorrow.length > 0) {
    const tasksHtml = data.tasksDueTomorrow
      .map((task) => taskCard({
        title: task.title,
        status: task.status,
        dueDate: 'Tomorrow',
        clientName: task.clientName,
        boardName: task.boardName,
      }))
      .join('');

    sections.push(`
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #C4959C; border-bottom: 2px solid #353165; padding-bottom: 8px;">
          Due Tomorrow (${data.tasksDueTomorrow.length})
        </h3>
        ${tasksHtml}
      </div>
    `);
  }

  // Unread notifications section
  if (data.unreadNotifications.length > 0) {
    const notificationsHtml = data.unreadNotifications
      .map((notif) => {
        const typeLabel = notif.type === 'mention'
          ? 'mentioned you in'
          : notif.type === 'task_assigned'
            ? 'assigned you to'
            : 'commented on';

        return `
          <div style="padding: 8px 0; border-bottom: 1px solid #42424a;">
            <span style="color: #d0d0d5;"><strong>${notif.actorName}</strong> ${typeLabel} "${notif.taskTitle}"</span>
          </div>
        `;
      })
      .join('');

    sections.push(`
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #a0a0a8; border-bottom: 2px solid #42424a; padding-bottom: 8px;">
          Unread Notifications (${data.unreadNotifications.length})
        </h3>
        ${notificationsHtml}
      </div>
    `);
  }

  // Empty state
  if (sections.length === 0) {
    sections.push(`
      <div style="text-align: center; padding: 24px; color: #a0a0a8;">
        <p style="margin: 0;">You're all caught up! No tasks due or new notifications.</p>
      </div>
    `);
  }

  const greeting = getGreeting();
  const formattedDate = formatEmailDate(data.date);

  const content = `
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #f5f5f5;">${greeting}, ${data.recipientName || 'there'}!</h2>
    <p style="margin: 0 0 24px; color: #a0a0a8; font-size: 14px;">Here's your summary for ${formattedDate}</p>
    ${sections.join('')}
    <div style="text-align: center; margin: 24px 0 8px;">
      ${emailButton('View My Tasks', myTasksUrl)}
    </div>
  `;

  return baseEmailTemplate(content, `Your daily digest for ${formattedDate}`);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
