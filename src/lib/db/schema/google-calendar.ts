import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

export const googleCalendarConnections = pgTable('google_calendar_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at').notNull(), // epoch seconds
  scope: text('scope'),
  email: varchar('email', { length: 255 }).notNull(),
  connectedAt: timestamp('connected_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});
