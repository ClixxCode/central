-- Auto-membership rule for rollup boards (Pulse-driven; null = legacy manual).
-- Column also applied to the live DB out-of-band; IF NOT EXISTS keeps re-runs safe.
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "rollup_rule" jsonb;
