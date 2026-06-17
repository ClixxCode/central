import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailLayout, EmailButton, TaskCard, CommentQuote } from '../components';

export interface CommentAddedEmailData {
  recipientName: string;
  commenterName: string;
  taskTitle: string;
  taskId: string;
  taskShortId?: string;
  boardId: string;
  clientSlug: string;
  ctaUrl?: string;
  commentPreview?: string;
  taskStatus: string;
  taskStatusColor?: string;
  taskStatusBackgroundColor?: string;
  taskDueDate?: string;
}

export function commentAddedEmailSubject(commenterName: string, taskTitle: string): string {
  return `${commenterName} commented on "${taskTitle}"`;
}

function CommentAddedEmail({ data }: { data: CommentAddedEmailData }) {
  const taskUrl = data.ctaUrl ?? (
    data.taskShortId
      ? `${getAppUrl()}/t/${data.taskShortId}`
      : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`
  );

  return (
    <EmailLayout preheader={`${data.commenterName} commented on "${data.taskTitle}"`}>
      <Text className="email-heading" style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#18181b' }}>
        New Comment
      </Text>
      <Text className="email-text" style={{ margin: '0 0 16px', color: '#3f3f46' }}>
        <strong className="email-strong" style={{ color: '#18181b' }}>{data.commenterName}</strong> added a comment on a task you&apos;re following:
      </Text>
      {data.commentPreview && (
        <CommentQuote>{data.commentPreview}</CommentQuote>
      )}
      <TaskCard
        title={data.taskTitle}
        status={data.taskStatus}
        statusColor={data.taskStatusColor}
        statusBackgroundColor={data.taskStatusBackgroundColor}
        dueDate={data.taskDueDate}
      />
      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <EmailButton href={taskUrl}>View Comment</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function commentAddedEmailHtml(data: CommentAddedEmailData): Promise<string> {
  return render(<CommentAddedEmail data={data} />);
}
