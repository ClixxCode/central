import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';
import { users } from './users';

/**
 * Append-only log of an agentic build's stage transitions. One row is written
 * every time a build enters a stage (create + each move). Time-in-stage and
 * total project duration are computed from consecutive `enteredAt` timestamps:
 *   duration(stage) = next event's enteredAt − this event's enteredAt
 *                     (or now, for the current stage of an incomplete build).
 * This is the source of truth behind "how long did it take, and how long did it
 * sit in Onboarding / Design System / Development / QA".
 */
export const buildStageEvents = pgTable(
  'build_stage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    stage: varchar('stage', { length: 50 }).notNull(),
    enteredAt: timestamp('entered_at').notNull().defaultNow(),
    // Who moved it (null for system/backfill).
    movedBy: uuid('moved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index('build_stage_events_task_idx').on(t.taskId, t.enteredAt),
  })
);

export const buildStageEventsRelations = relations(buildStageEvents, ({ one }) => ({
  task: one(tasks, { fields: [buildStageEvents.taskId], references: [tasks.id] }),
}));
