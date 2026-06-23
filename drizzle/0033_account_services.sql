-- Reflected active services from Pulse (consolidated reference on board/rollup
-- headers). Applied directly to the live Central database out-of-band as well;
-- IF NOT EXISTS keeps this migration safe against the already-updated database.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "account_services" jsonb DEFAULT '[]'::jsonb NOT NULL;
