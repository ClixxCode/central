import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export type AsyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AsyncJobPayload = Record<string, unknown>;

export const asyncJobs = pgTable(
  'async_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<AsyncJobPayload>().notNull().default({}),
    status: varchar('status', { length: 20 }).$type<AsyncJobStatus>().notNull().default('pending'),
    claimedBy: varchar('claimed_by', { length: 100 }),
    attempts: integer('attempts').notNull().default(0),
    lockedAt: timestamp('locked_at', { mode: 'date' }),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('async_jobs_dedupe_key_idx').on(table.dedupeKey),
    index('async_jobs_status_locked_at_idx').on(table.status, table.lockedAt),
    index('async_jobs_kind_status_idx').on(table.kind, table.status),
  ]
);
