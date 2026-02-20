import { Text, Section, Hr } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { formatEmailDate } from './base';
import { EmailLayout, EmailButton, TaskCard } from '../components';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function TaskSection({
  title,
  titleColor,
  borderColor,
  tasks,
}: {
  title: string;
  titleColor: string;
  borderColor: string;
  tasks: DigestTask[];
}) {
  if (tasks.length === 0) return null;

  return (
    <Section style={{ marginBottom: '24px' }}>
      <Text
        style={{
          margin: '0 0 12px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: titleColor,
          borderBottom: `2px solid ${borderColor}`,
          paddingBottom: '8px',
        }}
      >
        {title} ({tasks.length})
      </Text>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          title={task.title}
          status={task.status}
          dueDate={task.dueDate}
          clientName={task.clientName}
          boardName={task.boardName}
        />
      ))}
    </Section>
  );
}

function DailyDigestEmail({ data }: { data: DailyDigestEmailData }) {
  const myTasksUrl = `${getAppUrl()}/my-tasks`;
  const greeting = getGreeting();
  const formattedDate = formatEmailDate(data.date);

  const hasContent =
    data.tasksOverdue.length > 0 ||
    data.tasksDueToday.length > 0 ||
    data.tasksDueTomorrow.length > 0 ||
    data.unreadNotifications.length > 0;

  return (
    <EmailLayout preheader={`Your daily digest for ${formattedDate}`}>
      <Text style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        {greeting}, {data.recipientName || 'there'}!
      </Text>
      <Text style={{ margin: '0 0 24px', color: '#a0a0a8', fontSize: '14px' }}>
        Here&apos;s your summary for {formattedDate}
      </Text>

      {hasContent ? (
        <>
          <TaskSection
            title="Overdue"
            titleColor="#f87171"
            borderColor="#5c2b2b"
            tasks={data.tasksOverdue.map((t) => ({
              ...t,
              dueDate: t.dueDate ? formatEmailDate(t.dueDate) : undefined,
            }))}
          />
          <TaskSection
            title="Due Today"
            titleColor="#fbbf24"
            borderColor="#5c4a1e"
            tasks={data.tasksDueToday.map((t) => ({ ...t, dueDate: 'Today' }))}
          />
          <TaskSection
            title="Due Tomorrow"
            titleColor="#F5303D"
            borderColor="#353165"
            tasks={data.tasksDueTomorrow.map((t) => ({ ...t, dueDate: 'Tomorrow' }))}
          />

          {data.unreadNotifications.length > 0 && (
            <Section style={{ marginBottom: '24px' }}>
              <Text
                style={{
                  margin: '0 0 12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#a0a0a8',
                  borderBottom: '2px solid #42424a',
                  paddingBottom: '8px',
                }}
              >
                Unread Notifications ({data.unreadNotifications.length})
              </Text>
              {data.unreadNotifications.map((notif, i) => {
                const typeLabel =
                  notif.type === 'mention'
                    ? 'mentioned you in'
                    : notif.type === 'task_assigned'
                      ? 'assigned you to'
                      : 'commented on';

                return (
                  <Text
                    key={`${notif.taskId}-${i}`}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid #42424a',
                      color: '#d0d0d5',
                      margin: '0',
                    }}
                  >
                    <strong>{notif.actorName}</strong> {typeLabel} &ldquo;{notif.taskTitle}&rdquo;
                  </Text>
                );
              })}
            </Section>
          )}
        </>
      ) : (
        <Section style={{ textAlign: 'center' as const, padding: '24px' }}>
          <Text style={{ margin: '0', color: '#a0a0a8' }}>
            You&apos;re all caught up! No tasks due or new notifications.
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={myTasksUrl}>View My Tasks</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function dailyDigestEmailHtml(data: DailyDigestEmailData): Promise<string> {
  return render(<DailyDigestEmail data={data} />);
}
