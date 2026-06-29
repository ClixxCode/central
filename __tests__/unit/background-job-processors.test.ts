import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enqueueAsyncJob: vi.fn(),
  claimAsyncJob: vi.fn(),
  completeAsyncJob: vi.fn(),
  failAsyncJob: vi.fn(),
  skipAsyncJob: vi.fn(),
  usersFindMany: vi.fn(),
  inngestSend: vi.fn(),
  sendQueue: vi.fn(),
}));

vi.mock('@vercel/queue', () => {
  class DuplicateMessageError extends Error {}

  return {
    DuplicateMessageError,
    send: mocks.sendQueue,
  };
});

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
      users: {
        findMany: mocks.usersFindMany,
      },
      boards: {
        findMany: vi.fn(),
      },
      taskAssignees: {
        findMany: vi.fn(),
      },
      boardAccess: {
        findMany: vi.fn(),
      },
      teamMembers: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/actions/notifications', () => ({
  createDueNotification: vi.fn(),
}));

vi.mock('@/lib/email/client', () => ({
  getAppUrl: () => 'https://central.test',
}));

vi.mock('@/lib/email/send-template', () => ({
  sendCentralTemplateEmail: vi.fn(),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: mocks.inngestSend,
  },
}));

describe('background job processors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.enqueueAsyncJob.mockResolvedValue({ job: { id: 'job-1' }, created: false });
    mocks.completeAsyncJob.mockResolvedValue({ success: true });
    mocks.failAsyncJob.mockResolvedValue({ success: true });
    mocks.skipAsyncJob.mockResolvedValue({ success: true });
    mocks.inngestSend.mockResolvedValue({ ids: ['event-1'] });
    mocks.sendQueue.mockResolvedValue({ messageId: 'msg-1' });
  });

  it('does not schedule daily digests when another runner already claimed the job', async () => {
    const { processDailyDigestSchedule } = await import('@/lib/background-jobs');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: false,
      job: { id: 'job-1' },
      reason: 'already_running',
    });

    const result = await processDailyDigestSchedule(
      { orgDate: '2026-06-18' },
      { runnerId: 'vercel-queue' }
    );

    expect(result).toEqual({
      status: 'skipped',
      jobId: 'job-1',
      dedupeKey: 'daily-digest-schedule:2026-06-18',
      reason: 'Async job claim skipped: already_running',
      claimMissReason: 'already_running',
    });
    expect(mocks.usersFindMany).not.toHaveBeenCalled();
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it('schedules Inngest daily digest delivery for eligible users', async () => {
    const { processDailyDigestSchedule } = await import('@/lib/background-jobs');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: true,
      job: {
        id: 'job-1',
        dedupeKey: 'daily-digest-schedule:2026-06-18',
      },
    });
    mocks.usersFindMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        preferences: {
          notifications: {
            email: {
              enabled: true,
              digest: 'daily',
            },
          },
        },
      },
      {
        id: 'user-2',
        email: 'disabled@example.com',
        name: 'Disabled',
        preferences: {
          notifications: {
            email: {
              enabled: false,
              digest: 'daily',
            },
          },
        },
      },
    ]);

    const result = await processDailyDigestSchedule(
      { orgDate: '2026-06-18' },
      { runnerId: 'inngest' }
    );

    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: 'notification/daily-digest.scheduled',
      data: {
        userId: 'user-1',
        userEmail: 'user@example.com',
        userName: 'User One',
        orgDate: '2026-06-18',
      },
    });
    expect(mocks.completeAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'daily-digest-schedule:2026-06-18',
      claimedBy: 'inngest',
    });
    expect(result).toEqual({
      status: 'completed',
      jobId: 'job-1',
      dedupeKey: 'daily-digest-schedule:2026-06-18',
      summary: {
        users: 1,
        inngestEvents: 1,
        queueMessages: 0,
      },
    });
  });
});
