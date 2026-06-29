import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsyncJob } from '@/lib/async-jobs';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  asyncJobFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      asyncJobs: {
        findFirst: mocks.asyncJobFindFirst,
      },
    },
    insert: mocks.insert,
    update: mocks.update,
    select: mocks.select,
  },
}));

function job(overrides: Partial<AsyncJob> = {}): AsyncJob {
  const now = new Date('2026-06-18T12:00:00.000Z');

  return {
    id: 'job-1',
    dedupeKey: 'email:mention:notification-1',
    kind: 'email.mention',
    payload: { notificationId: 'notification-1' },
    status: 'pending',
    claimedBy: null,
    attempts: 0,
    lockedAt: null,
    completedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockInsertReturning(rows: AsyncJob[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  mocks.insert.mockReturnValue({ values });

  return { values, onConflictDoNothing, returning };
}

function mockUpdateReturning(rows: AsyncJob[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  mocks.update.mockReturnValue({ set });

  return { set, where, returning };
}

function mockSelectReturning(rows: AsyncJob[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));

  return { from, where, orderBy, limit };
}

describe('async job helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a pending async job with a stable dedupe key', async () => {
    const { enqueueAsyncJob } = await import('@/lib/async-jobs');
    const insertedJob = job();
    const insertChain = mockInsertReturning([insertedJob]);

    const result = await enqueueAsyncJob({
      dedupeKey: insertedJob.dedupeKey,
      kind: insertedJob.kind,
      payload: insertedJob.payload,
    });

    expect(result).toEqual({ job: insertedJob, created: true });
    expect(insertChain.values).toHaveBeenCalledWith({
      dedupeKey: insertedJob.dedupeKey,
      kind: insertedJob.kind,
      payload: insertedJob.payload,
    });
    expect(insertChain.onConflictDoNothing).toHaveBeenCalled();
    expect(mocks.asyncJobFindFirst).not.toHaveBeenCalled();
  });

  it('returns the existing job for duplicate dedupe keys of the same kind', async () => {
    const { enqueueAsyncJob } = await import('@/lib/async-jobs');
    const existingJob = job({ id: 'existing-job' });
    mockInsertReturning([]);
    mocks.asyncJobFindFirst.mockResolvedValue(existingJob);

    const result = await enqueueAsyncJob({
      dedupeKey: existingJob.dedupeKey,
      kind: existingJob.kind,
      payload: { notificationId: 'notification-1' },
    });

    expect(result).toEqual({ job: existingJob, created: false });
  });

  it('rejects dedupe key reuse across different job kinds', async () => {
    const { enqueueAsyncJob } = await import('@/lib/async-jobs');
    mockInsertReturning([]);
    mocks.asyncJobFindFirst.mockResolvedValue(job({ kind: 'slack.delivery' }));

    await expect(
      enqueueAsyncJob({
        dedupeKey: 'email:mention:notification-1',
        kind: 'email.mention',
      })
    ).rejects.toThrow('already exists with kind "slack.delivery"');
  });

  it('claims a pending job before side effects run', async () => {
    const { claimAsyncJob } = await import('@/lib/async-jobs');
    const claimedJob = job({
      status: 'running',
      claimedBy: 'inngest',
      attempts: 1,
      lockedAt: new Date('2026-06-18T12:00:00.000Z'),
    });
    const updateChain = mockUpdateReturning([claimedJob]);

    const result = await claimAsyncJob({
      dedupeKey: claimedJob.dedupeKey,
      runnerId: 'inngest',
    });

    expect(result).toEqual({ claimed: true, job: claimedJob });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        claimedBy: 'inngest',
        lockedAt: new Date('2026-06-18T12:00:00.000Z'),
        lastError: null,
      })
    );
  });

  it('reports a claim race when another runner already claimed the job', async () => {
    const { claimAsyncJob } = await import('@/lib/async-jobs');
    const runningJob = job({ status: 'running', claimedBy: 'queue' });
    mockUpdateReturning([]);
    mocks.asyncJobFindFirst.mockResolvedValue(runningJob);

    const result = await claimAsyncJob({
      dedupeKey: runningJob.dedupeKey,
      runnerId: 'inngest',
    });

    expect(result).toEqual({
      claimed: false,
      job: runningJob,
      reason: 'already_running',
    });
  });

  it('treats an unclaimed pending miss as a claim race loss', async () => {
    const { claimAsyncJob } = await import('@/lib/async-jobs');
    const pendingJob = job({ status: 'pending' });
    mockUpdateReturning([]);
    mocks.asyncJobFindFirst.mockResolvedValue(pendingJob);

    const result = await claimAsyncJob({
      dedupeKey: pendingJob.dedupeKey,
      runnerId: 'queue',
    });

    expect(result).toEqual({
      claimed: false,
      job: pendingJob,
      reason: 'claim_race_lost',
    });
  });

  it('marks a claimed job completed', async () => {
    const { completeAsyncJob } = await import('@/lib/async-jobs');
    const completedJob = job({
      status: 'completed',
      claimedBy: 'queue',
      completedAt: new Date('2026-06-18T12:00:00.000Z'),
    });
    const updateChain = mockUpdateReturning([completedJob]);

    const result = await completeAsyncJob({
      dedupeKey: completedJob.dedupeKey,
      claimedBy: 'queue',
    });

    expect(result).toEqual({ success: true, job: completedJob });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completedAt: new Date('2026-06-18T12:00:00.000Z'),
        lastError: null,
      })
    );
  });

  it('marks a claimed job failed with the provider error message', async () => {
    const { failAsyncJob } = await import('@/lib/async-jobs');
    const failedJob = job({
      status: 'failed',
      claimedBy: 'queue',
      attempts: 1,
      lastError: 'Resend unavailable',
    });
    const updateChain = mockUpdateReturning([failedJob]);

    const result = await failAsyncJob({
      dedupeKey: failedJob.dedupeKey,
      claimedBy: 'queue',
      error: new Error('Resend unavailable'),
    });

    expect(result).toEqual({ success: true, job: failedJob });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        claimedBy: 'queue',
        lastError: 'Resend unavailable',
      })
    );
  });

  it('can release a failed attempt back to pending for retryable internal errors', async () => {
    const { failAsyncJob } = await import('@/lib/async-jobs');
    const retryableJob = job({
      status: 'pending',
      claimedBy: null,
      lockedAt: null,
      lastError: 'Database unavailable',
    });
    const updateChain = mockUpdateReturning([retryableJob]);

    const result = await failAsyncJob({
      dedupeKey: retryableJob.dedupeKey,
      claimedBy: 'queue',
      error: 'Database unavailable',
      retryable: true,
    });

    expect(result).toEqual({ success: true, job: retryableJob });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        claimedBy: null,
        lockedAt: null,
        lastError: 'Database unavailable',
      })
    );
  });

  it('marks a job skipped when preferences or domain rules prevent work', async () => {
    const { skipAsyncJob } = await import('@/lib/async-jobs');
    const skippedJob = job({
      status: 'skipped',
      completedAt: new Date('2026-06-18T12:00:00.000Z'),
      lastError: 'User preferences',
    });
    const updateChain = mockUpdateReturning([skippedJob]);

    const result = await skipAsyncJob({
      dedupeKey: skippedJob.dedupeKey,
      reason: 'User preferences',
    });

    expect(result).toEqual({ success: true, job: skippedJob });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'skipped',
        completedAt: new Date('2026-06-18T12:00:00.000Z'),
        lastError: 'User preferences',
      })
    );
  });

  it('reports stale running, failed, and repeated-claim jobs for health checks', async () => {
    const { getAsyncJobHealth } = await import('@/lib/async-jobs');
    const staleRunningJob = job({
      dedupeKey: 'slack:comment:notification-1',
      kind: 'slack.delivery',
      status: 'running',
      attempts: 1,
      lockedAt: new Date('2026-06-18T11:30:00.000Z'),
    });
    const failedJob = job({
      dedupeKey: 'email:mention:notification-2',
      status: 'failed',
      attempts: 1,
      lastError: 'Provider unavailable',
    });
    const repeatedClaimJob = job({
      dedupeKey: 'daily-digest:user-1:2026-06-18',
      kind: 'daily-digest',
      status: 'pending',
      attempts: 5,
    });

    const staleSelect = mockSelectReturning([staleRunningJob]);
    const failedSelect = mockSelectReturning([failedJob]);
    const repeatedSelect = mockSelectReturning([repeatedClaimJob]);
    mocks.select
      .mockReturnValueOnce({ from: staleSelect.from })
      .mockReturnValueOnce({ from: failedSelect.from })
      .mockReturnValueOnce({ from: repeatedSelect.from });

    const result = await getAsyncJobHealth({
      staleAfterMs: 10 * 60 * 1000,
      repeatedClaimAttempts: 5,
      limit: 10,
    });

    expect(result).toEqual({
      checkedAt: new Date('2026-06-18T12:00:00.000Z'),
      staleAfterMs: 10 * 60 * 1000,
      repeatedClaimAttempts: 5,
      limit: 10,
      staleRunningJobs: [staleRunningJob],
      failedJobs: [failedJob],
      repeatedClaimJobs: [repeatedClaimJob],
    });
  });
});
