import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailLayout, EmailButton, TaskCard } from '../components';

export interface TaskAssignedEmailData {
  recipientName: string;
  assignerName: string;
  taskTitle: string;
  taskId: string;
  taskShortId?: string;
  boardId: string;
  clientSlug: string;
  ctaUrl?: string;
  clientName: string;
  boardName: string;
  taskStatus: string;
  taskStatusColor?: string;
  taskStatusBackgroundColor?: string;
  taskDueDate?: string;
  taskDescription?: string;
}

export function taskAssignedEmailSubject(taskTitle: string): string {
  return `You've been assigned to "${taskTitle}"`;
}

function TaskAssignedEmail({ data }: { data: TaskAssignedEmailData }) {
  const taskUrl = data.ctaUrl ?? (
    data.taskShortId
      ? `${getAppUrl()}/t/${data.taskShortId}`
      : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`
  );

  return (
    <EmailLayout preheader={`${data.assignerName} assigned you to "${data.taskTitle}"`}>
      <Text className="email-heading" style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>
        New Task Assignment
      </Text>
      <Text className="email-text" style={{ margin: '0 0 16px', color: '#3f3f46' }}>
        <strong className="email-strong" style={{ color: '#18181b' }}>{data.assignerName}</strong> assigned you to a task:
      </Text>
      <TaskCard
        title={data.taskTitle}
        status={data.taskStatus}
        statusColor={data.taskStatusColor}
        statusBackgroundColor={data.taskStatusBackgroundColor}
        dueDate={data.taskDueDate}
        clientName={data.clientName}
        boardName={data.boardName}
      />
      {data.taskDescription && (
        <Text className="email-muted" style={{ margin: '16px 0', color: '#71717a', fontSize: '14px' }}>
          {data.taskDescription}
        </Text>
      )}
      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={taskUrl}>View Task</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function taskAssignedEmailHtml(data: TaskAssignedEmailData): Promise<string> {
  return render(<TaskAssignedEmail data={data} />);
}
