import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MentionNotificationEvent } from '@/lib/inngest/events';

const mocks = vi.hoisted(() => ({
  enqueueAsyncJob: vi.fn(),
  claimAsyncJob: vi.fn(),
  completeAsyncJob: vi.fn(),
  failAsyncJob: vi.fn(),
  skipAsyncJob: vi.fn(),
  notificationFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  update: vi.fn(),
  sendCentralTemplateEmail: vi.fn(),
  sendSlackMessageToUser: vi.fn(),
  formatMentionNotification: vi.fn(),
  formatTaskAssignedNotification: vi.fn(),
  formatDueDateReminderNotification: vi.fn(),
  formatCommentAddedNotification: vi.fn(),
}));

vi.mock('@/lib/async-jobs', () => ({
  enqueueAsyncJob: mocks.enqueueAsyncJob,
  claimAsyncJob: mocks.claimAsyncJob,
  completeAsyncJob: mocks.completeAsyncJob,
  failAsyncJob: mocks.failAsyncJob,
  skipAsyncJob: mocks.skipAsyncJob,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      notifications: {
        findFirst: mocks.notificationFindFirst,
      },
      users: {
        findFirst: mocks.userFindFirst,
      },
    },
    update: mocks.update,
  },
}));

vi.mock('@/lib/email/client', () => ({
  getAppUrl: () => 'https://central.test',
}));

vi.mock('@/lib/email/send-template', () => ({
  sendCentralTemplateEmail: mocks.sendCentralTemplateEmail,
}));

vi.mock('@/lib/email/templates', () => ({
  CENTRAL_EMAIL_TEMPLATE_ALIASES: {
    mention: 'mention',
  },
  formatEmailDate: (value: string) => value,
  mentionEmailSubject: (mentionerName: string, taskTitle: string) =>
    `${mentionerName} mentioned you in ${taskTitle}`,
}));

vi.mock('@/lib/slack', () => ({
  sendSlackMessageToUser: mocks.sendSlackMessageToUser,
  formatMentionNotification: mocks.formatMentionNotification,
  formatTaskAssignedNotification: mocks.formatTaskAssignedNotification,
  formatDueDateReminderNotification: mocks.formatDueDateReminderNotification,
  formatCommentAddedNotification: mocks.formatCommentAddedNotification,
}));

function mentionData(
  overrides: Partial<MentionNotificationEvent['data']> = {}
): MentionNotificationEvent['data'] {
  return {
    notificationId: 'notification-1',
    recipientId: 'recipient-1',
    recipientEmail: 'recipient@example.com',
    recipientName: 'Recipient',
    mentionerName: 'Mentioner',
    taskId: 'task-1',
    taskShortId: 'T_1',
    taskTitle: 'Mentioned Task',
    taskStatus: 'Ready',
    taskStatusColor: '#c4c4c4',
    taskStatusBackgroundColor: '#f4f4f4',
    taskDueDate: null,
    boardId: 'board-1',
    clientSlug: 'client-slug',
    commentId: 'comment-1',
    commentPreview: 'Please check this',
    ...overrides,
  };
}

function mockUpdateResolved() {
  mocks.update.mockReturnValue({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  });
}

describe('notification delivery processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueueAsyncJob.mockResolvedValue({ job: { id: 'job-1' }, created: false });
    mocks.completeAsyncJob.mockResolvedValue({ success: true });
    mocks.failAsyncJob.mockResolvedValue({ success: true });
    mocks.skipAsyncJob.mockResolvedValue({ success: true });
    mocks.sendCentralTemplateEmail.mockResolvedValue({ data: { id: 'email-1' } });
    mocks.sendSlackMessageToUser.mockResolvedValue({ success: true });
    mocks.formatMentionNotification.mockReturnValue({ text: 'mentioned' });
    mockUpdateResolved();
  });

  it('does not send mention email when another runner already claimed the job', async () => {
    const { processMentionEmailDelivery } = await import('@/lib/notifications/delivery');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: false,
      job: { id: 'job-1' },
      reason: 'already_running',
    });

    const result = await processMentionEmailDelivery(mentionData(), { runnerId: 'queue' });

    expect(result).toEqual({
      status: 'skipped',
      channel: 'email',
      notificationId: 'notification-1',
      jobId: 'job-1',
      reason: 'Async job claim skipped: already_running',
      claimMissReason: 'already_running',
    });
    expect(mocks.sendCentralTemplateEmail).not.toHaveBeenCalled();
    expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
  });

  it('does not send Slack when another runner already claimed the job', async () => {
    const { processSlackNotificationDelivery } = await import('@/lib/notifications/delivery');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: false,
      job: { id: 'job-2' },
      reason: 'already_running',
    });

    const result = await processSlackNotificationDelivery(
      { notificationType: 'mention', data: mentionData() },
      { runnerId: 'inngest' }
    );

    expect(result).toEqual({
      status: 'skipped',
      channel: 'slack',
      notificationId: 'notification-1',
      jobId: 'job-2',
      reason: 'Async job claim skipped: already_running',
      claimMissReason: 'already_running',
    });
    expect(mocks.sendSlackMessageToUser).not.toHaveBeenCalled();
    expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
  });

  it('sends and completes a claimed mention email job', async () => {
    const { processMentionEmailDelivery } = await import('@/lib/notifications/delivery');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: true,
      job: {
        id: 'job-1',
        dedupeKey: 'email:mention:notification-1',
      },
    });
    mocks.notificationFindFirst.mockResolvedValue({
      id: 'notification-1',
      userId: 'recipient-1',
      type: 'mention',
      emailSentAt: null,
      slackSentAt: null,
    });
    mocks.userFindFirst.mockResolvedValue({
      preferences: {
        notifications: {
          email: {
            enabled: true,
            mentions: true,
            digest: 'instant',
          },
        },
      },
    });

    const result = await processMentionEmailDelivery(mentionData(), { runnerId: 'inngest' });

    expect(mocks.sendCentralTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
      })
    );
    expect(mocks.completeAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'email:mention:notification-1',
      claimedBy: 'inngest',
    });
    expect(result).toEqual({
      status: 'sent',
      channel: 'email',
      notificationId: 'notification-1',
      jobId: 'job-1',
      emailId: 'email-1',
    });
  });
});
