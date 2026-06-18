import { Link, Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailButton, EmailLayout } from '../components';
import type { EmailBatchableNotificationType } from '../notification-batches';

export interface BatchedNotificationEmailItem {
  id: string;
  type: EmailBatchableNotificationType;
  title: string;
  body: string | null;
  taskId: string | null;
  commentId: string | null;
  taskTitle: string | null;
  taskShortId: string | null;
  taskStatus: string | null;
  taskDueDate: string | null;
  boardId: string | null;
  boardName: string | null;
  clientName: string | null;
  clientSlug: string | null;
}

export interface BatchedNotificationsEmailData {
  recipientName: string;
  notifications: BatchedNotificationEmailItem[];
}

type NotificationSection = {
  title: string;
  types: EmailBatchableNotificationType[];
};

const sections: NotificationSection[] = [
  { title: 'Assignments', types: ['task_assigned'] },
  { title: 'Comments', types: ['comment_added'] },
  { title: 'Due dates', types: ['task_due_soon', 'task_overdue'] },
];

export function batchedNotificationsEmailSubject(count: number): string {
  return count === 1
    ? 'You have 1 new Central notification'
    : `You have ${count} new Central notifications`;
}

function notificationUrl(item: BatchedNotificationEmailItem): string {
  const appUrl = getAppUrl();

  if (item.commentId && item.clientSlug && item.boardId && item.taskId) {
    return `${appUrl}/clients/${item.clientSlug}/boards/${item.boardId}?task=${item.taskId}&comment=${item.commentId}`;
  }

  if (item.taskShortId) {
    return `${appUrl}/t/${item.taskShortId}`;
  }

  if (item.clientSlug && item.boardId && item.taskId) {
    return `${appUrl}/clients/${item.clientSlug}/boards/${item.boardId}?task=${item.taskId}`;
  }

  return `${appUrl}/my-tasks?tab=notifications`;
}

function ItemCard({ item }: { item: BatchedNotificationEmailItem }) {
  const location = [item.clientName, item.boardName].filter(Boolean).join(' / ');

  return (
    <Section
      style={{
        background: '#333338',
        border: '1px solid #42424a',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
      }}
    >
      <Text style={{ margin: '0 0 6px', color: '#f5f5f5', fontWeight: '600' }}>
        {item.title}
      </Text>
      {item.body && (
        <Text style={{ margin: '0 0 8px', color: '#a0a0a8', fontSize: '14px' }}>
          {item.body}
        </Text>
      )}
      {(item.taskStatus || item.taskDueDate || location) && (
        <Text style={{ margin: '0 0 8px', color: '#8d8d95', fontSize: '12px' }}>
          {[item.taskStatus, item.taskDueDate ? `Due: ${item.taskDueDate}` : null, location]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      )}
      <Link
        href={notificationUrl(item)}
        style={{ color: '#F5303D', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
      >
        Open
      </Link>
    </Section>
  );
}

function BatchedNotificationsEmail({ data }: { data: BatchedNotificationsEmailData }) {
  const count = data.notifications.length;
  const notificationsUrl = `${getAppUrl()}/my-tasks?tab=notifications`;

  return (
    <EmailLayout preheader={batchedNotificationsEmailSubject(count)}>
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        New notifications
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        Hi {data.recipientName}, here are the updates that came in close together.
      </Text>

      {sections.map((section) => {
        const items = data.notifications.filter((item) => section.types.includes(item.type));
        if (items.length === 0) return null;

        return (
          <Section key={section.title} style={{ margin: '18px 0 0' }}>
            <Text style={{ margin: '0 0 8px', color: '#f5f5f5', fontWeight: '700' }}>
              {section.title}
            </Text>
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </Section>
        );
      })}

      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={notificationsUrl}>View All Notifications</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function batchedNotificationsEmailHtml(
  data: BatchedNotificationsEmailData
): Promise<string> {
  return render(<BatchedNotificationsEmail data={data} />);
}
