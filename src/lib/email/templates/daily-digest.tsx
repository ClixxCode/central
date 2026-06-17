import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { formatEmailDate } from './base';
import { EmailLayout, EmailButton } from '../components';

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
  date: Date | string;
  tasksDueTodayCount: number | string;
  tasksDueTomorrowCount: number | string;
  tasksOverdueCount: number | string;
  unreadNotificationsCount: number | string;
  summaryText?: string;
  ctaUrl?: string;
}

export function dailyDigestEmailSubject(date: Date): string {
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return `Your Daily Digest - ${formatted}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function DailyDigestEmail({ data }: { data: DailyDigestEmailData }) {
  const myTasksUrl = data.ctaUrl ?? `${getAppUrl()}/my-tasks`;
  const greeting = getGreeting();
  const formattedDate = formatEmailDate(data.date);
  const summaryText =
    data.summaryText ??
    'Here is what needs your attention in Central today.';

  return (
    <EmailLayout preheader={`Your daily digest for ${formattedDate}`}>
      <Text className="email-heading" style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>
        {greeting}, {data.recipientName || 'there'}!
      </Text>
      <Text className="email-muted" style={{ margin: '0 0 16px', color: '#71717a', fontSize: '14px' }}>
        Here&apos;s your summary for {formattedDate}
      </Text>
      <Text className="email-text" style={{ margin: '0 0 20px', color: '#3f3f46' }}>
        {summaryText}
      </Text>

      <Section className="email-panel" style={{ background: '#f7f7f8', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '12px', margin: '0 0 20px' }}>
        <Text className="email-heading" style={{ color: '#18181b', fontSize: '14px', fontWeight: '700', margin: '0 0 8px' }}>
          Today at a glance
        </Text>
        <Text className="email-text" style={{ color: '#3f3f46', fontSize: '14px', margin: '0 0 6px' }}>
          Overdue: <strong className="email-strong" style={{ color: '#18181b' }}>{data.tasksOverdueCount}</strong>
        </Text>
        <Text className="email-text" style={{ color: '#3f3f46', fontSize: '14px', margin: '0 0 6px' }}>
          Due today: <strong className="email-strong" style={{ color: '#18181b' }}>{data.tasksDueTodayCount}</strong>
        </Text>
        <Text className="email-text" style={{ color: '#3f3f46', fontSize: '14px', margin: '0 0 6px' }}>
          Due tomorrow: <strong className="email-strong" style={{ color: '#18181b' }}>{data.tasksDueTomorrowCount}</strong>
        </Text>
        <Text className="email-text" style={{ color: '#3f3f46', fontSize: '14px', margin: '0' }}>
          Unread notifications: <strong className="email-strong" style={{ color: '#18181b' }}>{data.unreadNotificationsCount}</strong>
        </Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={myTasksUrl}>View My Tasks</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function dailyDigestEmailHtml(data: DailyDigestEmailData): Promise<string> {
  return render(<DailyDigestEmail data={data} />);
}
