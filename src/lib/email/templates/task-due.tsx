import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { formatEmailDate } from './base';
import { EmailLayout, EmailButton, TaskCard } from '../components';

export interface TaskDueEmailData {
  recipientName: string;
  taskTitle: string;
  taskId: string;
  taskShortId?: string;
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

function TaskDueEmail({ data }: { data: TaskDueEmailData }) {
  const taskUrl = data.taskShortId
    ? `${getAppUrl()}/t/${data.taskShortId}`
    : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;
  const formattedDate = formatEmailDate(data.dueDate);

  const headerColor = data.isOverdue ? '#f87171' : '#fbbf24';
  const headerText = data.isOverdue ? 'Task Overdue' : 'Task Due Soon';
  const messageText = data.isOverdue
    ? <>This task was due on <strong>{formattedDate}</strong> and needs your attention.</>
    : <>This task is due on <strong>{formattedDate}</strong>. Don&apos;t forget to complete it!</>;

  return (
    <EmailLayout
      preheader={
        data.isOverdue
          ? `"${data.taskTitle}" is overdue`
          : `"${data.taskTitle}" is due ${formattedDate}`
      }
    >
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: headerColor }}>
        {headerText}
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        {messageText}
      </Text>
      <TaskCard
        title={data.taskTitle}
        status={data.taskStatus}
        dueDate={formattedDate}
        clientName={data.clientName}
        boardName={data.boardName}
      />
      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={taskUrl}>View Task</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function taskDueEmailHtml(data: TaskDueEmailData): Promise<string> {
  return render(<TaskDueEmail data={data} />);
}
