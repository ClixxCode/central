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
  commentPreview?: string;
  taskStatus: string;
  taskDueDate?: string;
}

export function commentAddedEmailSubject(commenterName: string, taskTitle: string): string {
  return `${commenterName} commented on "${taskTitle}"`;
}

function CommentAddedEmail({ data }: { data: CommentAddedEmailData }) {
  const taskUrl = data.taskShortId
    ? `${getAppUrl()}/t/${data.taskShortId}`
    : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  return (
    <EmailLayout preheader={`${data.commenterName} commented on "${data.taskTitle}"`}>
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        New Comment
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        <strong>{data.commenterName}</strong> added a comment on a task you&apos;re following:
      </Text>
      {data.commentPreview && (
        <CommentQuote>{data.commentPreview}</CommentQuote>
      )}
      <TaskCard
        title={data.taskTitle}
        status={data.taskStatus}
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
