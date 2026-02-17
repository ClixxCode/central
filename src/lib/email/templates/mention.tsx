import { Text, Section } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailLayout, EmailButton, TaskCard, CommentQuote } from '../components';

export interface MentionEmailData {
  recipientName: string;
  mentionerName: string;
  taskTitle: string;
  taskId: string;
  taskShortId?: string;
  boardId: string;
  clientSlug: string;
  commentPreview?: string;
  taskStatus: string;
  taskDueDate?: string;
}

export function mentionEmailSubject(mentionerName: string, taskTitle: string): string {
  return `${mentionerName} mentioned you in "${taskTitle}"`;
}

function MentionEmail({ data }: { data: MentionEmailData }) {
  const taskUrl = data.taskShortId
    ? `${getAppUrl()}/t/${data.taskShortId}`
    : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

  return (
    <EmailLayout preheader={`${data.mentionerName} mentioned you in "${data.taskTitle}"`}>
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        You were mentioned
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        <strong>{data.mentionerName}</strong> mentioned you in a comment on the following task:
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
        <EmailButton href={taskUrl}>View Task</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export async function mentionEmailHtml(data: MentionEmailData): Promise<string> {
  return render(<MentionEmail data={data} />);
}
