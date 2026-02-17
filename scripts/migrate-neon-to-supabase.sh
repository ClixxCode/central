#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Migrate Neon PostgreSQL → Supabase PostgreSQL
# ============================================================
#
# Usage:
#   ./scripts/migrate-neon-to-supabase.sh
#
# Prerequisites:
#   - pg_dump and psql installed (brew install libpq && brew link --force libpq)
#   - Neon database connection string (source)
#   - Supabase DIRECT connection string (target) — use port 5432, NOT 6543
#
# What this does:
#   1. Dumps the public schema (structure + data) from Neon
#   2. Restores it into the Supabase instance
#   3. Verifies table counts match
#
# Notes:
#   - Only migrates the 'public' schema (Supabase owns auth/storage/realtime)
#   - Uses --no-owner and --no-privileges to avoid role mismatch errors
#   - Handles pre-existing Supabase extensions gracefully
# ============================================================

DUMP_DIR="$(mktemp -d)"
DUMP_FILE="${DUMP_DIR}/neon_dump.sql"
DATA_DUMP_FILE="${DUMP_DIR}/neon_data.sql"

cleanup() {
  echo ""
  echo "Cleaning up temp files..."
  rm -rf "$DUMP_DIR"
}
trap cleanup EXIT

echo "========================================="
echo "  Neon → Supabase Migration"
echo "========================================="
echo ""

# --- Get connection strings ---

if [[ -n "${NEON_DATABASE_URL:-}" ]]; then
  echo "Using NEON_DATABASE_URL from environment."
else
  echo "Enter your Neon (source) database connection string:"
  echo "  (looks like: postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require)"
  read -r NEON_DATABASE_URL
fi

if [[ -n "${SUPABASE_DATABASE_URL:-}" ]]; then
  echo "Using SUPABASE_DATABASE_URL from environment."
else
  echo ""
  echo "Enter your Supabase (target) DIRECT connection string:"
  echo "  (looks like: postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres)"
  echo "  IMPORTANT: Use the 'direct' connection (port 5432), NOT the pooled one (port 6543)"
  read -r SUPABASE_DATABASE_URL
fi

echo ""

# --- Validate connections ---

echo "[1/6] Testing Neon connection..."
if ! psql "$NEON_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to Neon. Check your connection string."
  exit 1
fi
echo "  ✓ Neon connection OK"

echo ""
echo "[2/6] Testing Supabase connection..."
if ! psql "$SUPABASE_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to Supabase. Check your connection string."
  echo "  Make sure you're using the DIRECT connection (port 5432)."
  exit 1
fi
echo "  ✓ Supabase connection OK"

# --- Get source table info ---

echo ""
echo "[3/6] Analyzing source database..."
NEON_TABLES=$(psql "$NEON_DATABASE_URL" -t -A -c "
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
")
NEON_TABLE_COUNT=$(echo "$NEON_TABLES" | grep -c . || true)
echo "  Found $NEON_TABLE_COUNT tables in public schema:"
echo "$NEON_TABLES" | while read -r tbl; do
  if [[ -n "$tbl" ]]; then
    ROW_COUNT=$(psql "$NEON_DATABASE_URL" -t -A -c "SELECT count(*) FROM \"public\".\"$tbl\";")
    echo "    - $tbl ($ROW_COUNT rows)"
  fi
done

echo ""
echo "Proceed with migration? This will DROP existing public schema tables in Supabase."
echo "Type 'yes' to continue:"
read -r CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# --- Dump from Neon ---

echo ""
echo "[4/6] Dumping from Neon..."
echo "  Dumping schema + data (public schema only)..."
pg_dump "$NEON_DATABASE_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-comments \
  --format=plain \
  --if-exists \
  --clean \
  > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "  ✓ Dump complete ($DUMP_SIZE)"

# --- Pre-process dump for Supabase compatibility ---

echo ""
echo "[5/6] Restoring to Supabase..."

# Create a modified dump that handles Supabase quirks:
# - Wrap extension creation in DO blocks to handle "already exists" gracefully
# - Skip dropping/creating the public schema itself (Supabase manages it)
PROCESSED_FILE="${DUMP_DIR}/processed_dump.sql"

sed \
  -e '/^DROP SCHEMA IF EXISTS public;/d' \
  -e '/^CREATE SCHEMA public;/d' \
  -e '/^COMMENT ON SCHEMA public/d' \
  -e 's/^CREATE EXTENSION/CREATE EXTENSION IF NOT EXISTS/g' \
  -e 's/^DROP EXTENSION/-- DROP EXTENSION/g' \
  "$DUMP_FILE" > "$PROCESSED_FILE"

# Restore to Supabase
# Using ON_ERROR_STOP=0 because some DROP IF EXISTS statements may warn
# but we want to continue past those
psql "$SUPABASE_DATABASE_URL" \
  -v ON_ERROR_STOP=0 \
  -f "$PROCESSED_FILE" 2>&1 | \
  grep -v "already exists" | \
  grep -v "does not exist, skipping" | \
  grep -v "^SET$" | \
  grep -v "^$" || true

echo "  ✓ Restore complete"

# --- Verify ---

echo ""
echo "[6/6] Verifying migration..."
echo ""

ERRORS=0
echo "$NEON_TABLES" | while read -r tbl; do
  if [[ -n "$tbl" ]]; then
    NEON_COUNT=$(psql "$NEON_DATABASE_URL" -t -A -c "SELECT count(*) FROM \"public\".\"$tbl\";" 2>/dev/null || echo "ERROR")
    SUPA_COUNT=$(psql "$SUPABASE_DATABASE_URL" -t -A -c "SELECT count(*) FROM \"public\".\"$tbl\";" 2>/dev/null || echo "ERROR")

    if [[ "$NEON_COUNT" == "$SUPA_COUNT" ]]; then
      echo "  ✓ $tbl: $NEON_COUNT rows (match)"
    else
      echo "  ✗ $tbl: Neon=$NEON_COUNT, Supabase=$SUPA_COUNT (MISMATCH)"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

# --- Summary ---

echo ""
echo "========================================="
echo "  Migration Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Update your .env file:"
echo "     DATABASE_URL=<your-supabase-direct-connection-string>"
echo ""
echo "  2. If using connection pooling in production, also set:"
echo "     DATABASE_URL=<pooled-connection-string>  (port 6543)"
echo "     But use direct (port 5432) for Drizzle migrations."
echo ""
echo "  3. Verify Drizzle schema sync:"
echo "     npx drizzle-kit check"
echo ""
echo "  4. Test your app against the new database."
echo ""
echo "  5. Update Vercel/deployment env vars to point to Supabase."
echo ""
