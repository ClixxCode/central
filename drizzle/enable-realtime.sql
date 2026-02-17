-- Enable Supabase Realtime on tables used for live cache invalidation.
-- Run this via the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- This is NOT a Drizzle migration — it configures the supabase_realtime publication.

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE task_assignees;
