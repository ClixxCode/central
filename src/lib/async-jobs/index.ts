import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '@/lib/db';
import { asyncJobs, type AsyncJobPayload, type AsyncJobStatus } from '@/lib/db/schema';

export const DEFAULT_ASYNC_JOB_STALE_AFTER_MS = 15 * 60 * 1000;
export const DEFAULT_ASYNC_JOB_REPEATED_CLAIM_ATTEMPTS = 5;
export const DEFAULT_ASYNC_JOB_HEALTH_LIMIT = 25;

export type AsyncJob = typeof asyncJobs.$inferSelect;

export type EnqueueAsyncJobInput = {
  dedupeKey: string;
  kind: string;
  payload?: AsyncJobPayload;
};

export type EnqueueAsyncJobResult = {
  job: AsyncJob;
  created: boolean;
};

export type ClaimAsyncJobInput = {
  dedupeKey: string;
  runnerId: string;
  reclaimStaleAfterMs?: number;
};

export type ClaimAsyncJobResult =
  | { claimed: true; job: AsyncJob }
  | { claimed: false; job: AsyncJob | null; reason: AsyncJobClaimMissReason };

export type AsyncJobClaimMissReason =
  | 'not_found'
  | 'already_running'
  | 'already_completed'
  | 'already_failed'
  | 'already_skipped'
  | 'claim_race_lost';

export type AsyncJobMutationResult =
  | { success: true; job: AsyncJob }
  | { success: false; job: AsyncJob | null; reason: AsyncJobClaimMissReason | 'not_running' };

export type CompleteAsyncJobInput = {
  dedupeKey: string;
  claimedBy?: string;
};

export type FailAsyncJobInput = {
  dedupeKey: string;
  error: unknown;
  claimedBy?: string;
  retryable?: boolean;
};

export type SkipAsyncJobInput = {
  dedupeKey: string;
  reason: string;
  claimedBy?: string;
};

export type AsyncJobHealthOptions = {
  staleAfterMs?: number;
  repeatedClaimAttempts?: number;
  limit?: number;
};

export type AsyncJobHealthReport = {
  checkedAt: Date;
  staleAfterMs: number;
  repeatedClaimAttempts: number;
  limit: number;
  staleRunningJobs: AsyncJob[];
  failedJobs: AsyncJob[];
  repeatedClaimJobs: AsyncJob[];
};

const activeOrFailedStatuses: AsyncJobStatus[] = ['pending', 'running', 'failed'];

export async function enqueueAsyncJob(
  input: EnqueueAsyncJobInput
): Promise<EnqueueAsyncJobResult> {
  const [insertedJob] = await db
    .insert(asyncJobs)
    .values({
      dedupeKey: input.dedupeKey,
      kind: input.kind,
      payload: input.payload ?? {},
    })
    .onConflictDoNothing({ target: asyncJobs.dedupeKey })
    .returning();

  if (insertedJob) {
    return { job: insertedJob, created: true };
  }

  const existingJob = await getAsyncJob(input.dedupeKey);
  if (!existingJob) {
    throw new Error(`Async job "${input.dedupeKey}" was not inserted and could not be found`);
  }
  if (existingJob.kind !== input.kind) {
    throw new Error(
      `Async job "${input.dedupeKey}" already exists with kind "${existingJob.kind}", not "${input.kind}"`
    );
  }

  return { job: existingJob, created: false };
}

export async function getAsyncJob(dedupeKey: string): Promise<AsyncJob | null> {
  const job = await db.query.asyncJobs.findFirst({
    where: eq(asyncJobs.dedupeKey, dedupeKey),
  });

  return job ?? null;
}

export async function claimAsyncJob(input: ClaimAsyncJobInput): Promise<ClaimAsyncJobResult> {
  const now = new Date();
  const claimableStatus = input.reclaimStaleAfterMs
    ? or(
        eq(asyncJobs.status, 'pending'),
        and(
          eq(asyncJobs.status, 'running'),
          or(
            isNull(asyncJobs.lockedAt),
            lt(asyncJobs.lockedAt, new Date(now.getTime() - input.reclaimStaleAfterMs))
          )
        )
      )
    : eq(asyncJobs.status, 'pending');

  const [claimedJob] = await db
    .update(asyncJobs)
    .set({
      status: 'running',
      claimedBy: input.runnerId,
      attempts: sql`${asyncJobs.attempts} + 1`,
      lockedAt: now,
      completedAt: null,
      lastError: null,
      updatedAt: now,
    })
    .where(and(eq(asyncJobs.dedupeKey, input.dedupeKey), claimableStatus))
    .returning();

  if (claimedJob) {
    return { claimed: true, job: claimedJob };
  }

  const existingJob = await getAsyncJob(input.dedupeKey);
  return {
    claimed: false,
    job: existingJob,
    reason: getClaimMissReason(existingJob),
  };
}

export async function completeAsyncJob(
  input: CompleteAsyncJobInput
): Promise<AsyncJobMutationResult> {
  const now = new Date();
  const conditions = [
    eq(asyncJobs.dedupeKey, input.dedupeKey),
    eq(asyncJobs.status, 'running'),
  ];
  if (input.claimedBy) {
    conditions.push(eq(asyncJobs.claimedBy, input.claimedBy));
  }

  const [completedJob] = await db
    .update(asyncJobs)
    .set({
      status: 'completed',
      completedAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning();

  if (completedJob) {
    return { success: true, job: completedJob };
  }

  return buildMutationMissResult(input.dedupeKey);
}

export async function failAsyncJob(input: FailAsyncJobInput): Promise<AsyncJobMutationResult> {
  const now = new Date();
  const conditions = [
    eq(asyncJobs.dedupeKey, input.dedupeKey),
    eq(asyncJobs.status, 'running'),
  ];
  if (input.claimedBy) {
    conditions.push(eq(asyncJobs.claimedBy, input.claimedBy));
  }

  const [failedJob] = await db
    .update(asyncJobs)
    .set({
      status: input.retryable ? 'pending' : 'failed',
      claimedBy: input.retryable ? null : input.claimedBy ?? null,
      lockedAt: input.retryable ? null : now,
      completedAt: null,
      lastError: normalizeErrorMessage(input.error),
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning();

  if (failedJob) {
    return { success: true, job: failedJob };
  }

  return buildMutationMissResult(input.dedupeKey);
}

export async function skipAsyncJob(input: SkipAsyncJobInput): Promise<AsyncJobMutationResult> {
  const now = new Date();
  const statusCondition = inArray(asyncJobs.status, ['pending', 'running']);
  const claimedByCondition = input.claimedBy
    ? or(eq(asyncJobs.status, 'pending'), eq(asyncJobs.claimedBy, input.claimedBy))
    : undefined;

  const [skippedJob] = await db
    .update(asyncJobs)
    .set({
      status: 'skipped',
      completedAt: now,
      lastError: input.reason,
      updatedAt: now,
    })
    .where(
      and(
        eq(asyncJobs.dedupeKey, input.dedupeKey),
        statusCondition,
        claimedByCondition
      )
    )
    .returning();

  if (skippedJob) {
    return { success: true, job: skippedJob };
  }

  return buildMutationMissResult(input.dedupeKey);
}

export async function getAsyncJobHealth(
  options: AsyncJobHealthOptions = {}
): Promise<AsyncJobHealthReport> {
  const checkedAt = new Date();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_ASYNC_JOB_STALE_AFTER_MS;
  const repeatedClaimAttempts =
    options.repeatedClaimAttempts ?? DEFAULT_ASYNC_JOB_REPEATED_CLAIM_ATTEMPTS;
  const limit = options.limit ?? DEFAULT_ASYNC_JOB_HEALTH_LIMIT;
  const staleCutoff = new Date(checkedAt.getTime() - staleAfterMs);

  const [staleRunningJobs, failedJobs, repeatedClaimJobs] = await Promise.all([
    db
      .select()
      .from(asyncJobs)
      .where(
        and(
          eq(asyncJobs.status, 'running'),
          or(isNull(asyncJobs.lockedAt), lt(asyncJobs.lockedAt, staleCutoff))
        )
      )
      .orderBy(asc(asyncJobs.lockedAt))
      .limit(limit),
    db
      .select()
      .from(asyncJobs)
      .where(eq(asyncJobs.status, 'failed'))
      .orderBy(desc(asyncJobs.updatedAt))
      .limit(limit),
    db
      .select()
      .from(asyncJobs)
      .where(
        and(
          inArray(asyncJobs.status, activeOrFailedStatuses),
          gte(asyncJobs.attempts, repeatedClaimAttempts)
        )
      )
      .orderBy(desc(asyncJobs.attempts), desc(asyncJobs.updatedAt))
      .limit(limit),
  ]);

  return {
    checkedAt,
    staleAfterMs,
    repeatedClaimAttempts,
    limit,
    staleRunningJobs,
    failedJobs,
    repeatedClaimJobs,
  };
}

async function buildMutationMissResult(dedupeKey: string): Promise<AsyncJobMutationResult> {
  const existingJob = await getAsyncJob(dedupeKey);
  const reason = getClaimMissReason(existingJob);

  return {
    success: false,
    job: existingJob,
    reason: reason === 'already_running' ? 'not_running' : reason,
  };
}

function getClaimMissReason(job: AsyncJob | null): AsyncJobClaimMissReason {
  if (!job) return 'not_found';
  if (job.status === 'running') return 'already_running';
  if (job.status === 'completed') return 'already_completed';
  if (job.status === 'failed') return 'already_failed';
  if (job.status === 'skipped') return 'already_skipped';
  return 'claim_race_lost';
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
