import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailLayout, EmailButton, TaskCard } from '../components';

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

function TaskAssignedEmail({ data }: { data: TaskAssignedEmailData }) {
  const taskUrl = `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  return (
    <EmailLayout preheader={`${data.assignerName} assigned you to "${data.taskTitle}"`}>
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        New Task Assignment
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        <strong>{data.assignerName}</strong> assigned you to a task:
      </Text>
      <TaskCard
        title={data.taskTitle}
        status={data.taskStatus}
        dueDate={data.taskDueDate}
        clientName={data.clientName}
        boardName={data.boardName}
      />
      {data.taskDescription && (
        <Text style={{ margin: '16px 0', color: '#a0a0a8', fontSize: '14px' }}>
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
