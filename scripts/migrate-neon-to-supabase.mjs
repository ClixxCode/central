#!/usr/bin/env node

// ============================================================
// Migrate Neon PostgreSQL → Supabase PostgreSQL
// ============================================================
//
// Usage:
//   node scripts/migrate-neon-to-supabase.mjs
//
// Reads NEON source from .env (DATABASE_URL) and migrates
// schema + data to a Supabase PostgreSQL instance.
//
// Uses the Node.js 'pg' driver since psql/pg_dump have
// connectivity issues with Supabase's pooler endpoint.
// ============================================================

import pg from "pg";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const SUPABASE_URL = "postgresql://postgres.ckzqissxugofxogorrsm:jnWe37oqKszDzO0T@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const NEON_URL = "postgresql://neondb_owner:npg_1CYf9lkxyemi@ep-jolly-flower-aexrlkcj-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

if (!NEON_URL) {
  console.error("ERROR: DATABASE_URL not found in .env");
  process.exit(1);
}

function createClient(url) {
  return new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
}

async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getTables(client) {
  const res = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  return res.rows.map((r) => r.tablename);
}

async function getTableCount(client, table) {
  const res = await client.query(`SELECT count(*)::int AS cnt FROM "${table}"`);
  return res.rows[0].cnt;
}

async function getEnums(client) {
  const res = await client.query(`
    SELECT t.typname AS enum_name,
           json_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `);
  return res.rows;
}

async function getExtensions(client) {
  const res = await client.query(
    "SELECT extname FROM pg_extension WHERE extname != 'plpgsql'"
  );
  return res.rows.map((r) => r.extname);
}

async function getTableDDL(client, table) {
  // Get columns
  const cols = await client.query(
    `
    SELECT column_name, data_type, udt_name, column_default, is_nullable,
           character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [table]
  );

  // Get primary key
  const pk = await client.query(
    `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY kcu.ordinal_position
  `,
    [table]
  );

  // Get unique constraints
  const unique = await client.query(
    `
    SELECT tc.constraint_name, json_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    GROUP BY tc.constraint_name
  `,
    [table]
  );

  // Get foreign keys
  const fks = await client.query(
    `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
  `,
    [table]
  );

  return { columns: cols.rows, primaryKey: pk.rows, unique: unique.rows, foreignKeys: fks.rows };
}

function buildColumnDef(col) {
  let type;
  if (col.data_type === "USER-DEFINED") {
    type = `"${col.udt_name}"`;
  } else if (col.data_type === "ARRAY") {
    // Array of user-defined type — udt_name starts with _
    const baseType = col.udt_name.startsWith("_")
      ? `"${col.udt_name.slice(1)}"`
      : col.udt_name;
    type = `${baseType}[]`;
  } else if (col.data_type === "character varying") {
    type = col.character_maximum_length
      ? `varchar(${col.character_maximum_length})`
      : "varchar";
  } else if (col.data_type === "character") {
    type = col.character_maximum_length
      ? `char(${col.character_maximum_length})`
      : "char";
  } else if (col.data_type === "numeric") {
    type =
      col.numeric_precision != null
        ? `numeric(${col.numeric_precision},${col.numeric_scale})`
        : "numeric";
  } else {
    type = col.data_type;
  }

  let def = `"${col.column_name}" ${type}`;
  if (col.column_default != null) {
    def += ` DEFAULT ${col.column_default}`;
  }
  if (col.is_nullable === "NO") {
    def += " NOT NULL";
  }
  return def;
}

async function getIndexes(client, table) {
  const res = await client.query(
    `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
      AND indexname NOT IN (
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = $1
      )
  `,
    [table]
  );
  return res.rows;
}

async function getSequences(client) {
  const res = await client.query(`
    SELECT sequence_name, start_value, increment, minimum_value, maximum_value
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `);
  return res.rows;
}

async function getTableData(client, table) {
  const res = await client.query(`SELECT * FROM "${table}"`);
  return res.rows;
}

// ============================================================
// Main migration
// ============================================================

async function main() {
  console.log("=========================================");
  console.log("  Neon → Supabase Migration");
  console.log("=========================================\n");

  // --- Connect ---
  console.log("[1/7] Connecting to databases...");

  const neon = createClient(NEON_URL);
  const supa = createClient(SUPABASE_URL);

  await neon.connect();
  console.log("  ✓ Neon connected");

  await supa.connect();
  console.log("  ✓ Supabase connected");

  // --- Analyze source ---
  console.log("\n[2/7] Analyzing source database...");

  const tables = await getTables(neon);
  console.log(`  Found ${tables.length} tables:`);

  const tableCounts = {};
  for (const t of tables) {
    const count = await getTableCount(neon, t);
    tableCounts[t] = count;
    console.log(`    - ${t} (${count} rows)`);
  }

  // --- Confirm ---
  const answer = await ask(
    "\nProceed with migration? This will DROP and recreate tables in Supabase. Type 'yes': "
  );
  if (answer !== "yes") {
    console.log("Aborted.");
    await neon.end();
    await supa.end();
    process.exit(0);
  }

  // --- Create enums ---
  console.log("\n[3/7] Creating enums...");

  const enums = await getEnums(neon);
  for (const e of enums) {
    const values = e.enum_values.map((v) => `'${v}'`).join(", ");
    await supa
      .query(`DROP TYPE IF EXISTS "${e.enum_name}" CASCADE`)
      .catch(() => {});
    await supa.query(`CREATE TYPE "${e.enum_name}" AS ENUM (${values})`);
    console.log(`  ✓ ${e.enum_name} (${e.enum_values.length} values)`);
  }

  // --- Create extensions ---
  console.log("\n[4/7] Creating extensions...");

  const extensions = await getExtensions(neon);
  for (const ext of extensions) {
    try {
      await supa.query(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
      console.log(`  ✓ ${ext}`);
    } catch (err) {
      console.log(`  ⚠ ${ext}: ${err.message}`);
    }
  }

  // --- Build dependency order (respect FKs) ---
  console.log("\n[5/7] Creating tables...");

  // Get all FK dependencies to determine creation order
  const deps = {};
  const ddls = {};
  for (const t of tables) {
    const ddl = await getTableDDL(neon, t);
    ddls[t] = ddl;
    deps[t] = ddl.foreignKeys
      .map((fk) => fk.foreign_table_name)
      .filter((ft) => ft !== t); // exclude self-references
  }

  // Topological sort
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(table) {
    if (visited.has(table)) return;
    if (visiting.has(table)) {
      // Circular dependency — just push it, FKs will be added later
      return;
    }
    visiting.add(table);
    for (const dep of deps[table] || []) {
      if (tables.includes(dep)) visit(dep);
    }
    visiting.delete(table);
    visited.add(table);
    ordered.push(table);
  }

  for (const t of tables) visit(t);

  // Drop tables in reverse order
  for (const t of [...ordered].reverse()) {
    await supa.query(`DROP TABLE IF EXISTS "${t}" CASCADE`).catch(() => {});
  }

  // Create tables
  for (const t of ordered) {
    const ddl = ddls[t];

    const colDefs = ddl.columns.map(buildColumnDef);

    // Primary key
    if (ddl.primaryKey.length > 0) {
      const pkCols = ddl.primaryKey.map((r) => `"${r.column_name}"`).join(", ");
      colDefs.push(`PRIMARY KEY (${pkCols})`);
    }

    // Unique constraints
    for (const u of ddl.unique) {
      const uCols = u.columns.map((c) => `"${c}"`).join(", ");
      colDefs.push(`CONSTRAINT "${u.constraint_name}" UNIQUE (${uCols})`);
    }

    const createSQL = `CREATE TABLE "${t}" (\n  ${colDefs.join(",\n  ")}\n)`;
    try {
      await supa.query(createSQL);
      console.log(`  ✓ ${t}`);
    } catch (err) {
      console.error(`  ✗ ${t}: ${err.message}`);
      console.error(`    SQL: ${createSQL.substring(0, 200)}...`);
    }
  }

  // Add foreign keys after all tables exist
  console.log("\n  Adding foreign keys...");
  for (const t of ordered) {
    for (const fk of ddls[t].foreignKeys) {
      const onDelete =
        fk.delete_rule !== "NO ACTION" ? ` ON DELETE ${fk.delete_rule}` : "";
      const onUpdate =
        fk.update_rule !== "NO ACTION" ? ` ON UPDATE ${fk.update_rule}` : "";
      const sql = `ALTER TABLE "${t}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}")${onDelete}${onUpdate}`;
      try {
        await supa.query(sql);
        console.log(`  ✓ ${t}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      } catch (err) {
        console.error(`  ✗ FK ${fk.constraint_name}: ${err.message}`);
      }
    }
  }

  // --- Copy data ---
  console.log("\n[6/7] Copying data...");

  // Disable FK checks during bulk import
  await supa.query("SET session_replication_role = 'replica'");
  console.log("  (FK checks disabled for bulk import)\n");

  // Insert data in dependency order
  for (const t of ordered) {
    const rows = await getTableData(neon, t);
    if (rows.length === 0) {
      console.log(`  - ${t}: 0 rows (skipped)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    // Batch insert in chunks of 100
    const BATCH = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        const placeholders = columns.map(() => `$${paramIdx++}`);
        values.push(`(${placeholders.join(", ")})`);
        for (const col of columns) {
          let val = row[col];
          // Handle JSON/JSONB — pg driver returns objects/arrays, need to stringify for insert
          if (val !== null && typeof val === "object" && !(val instanceof Date)) {
            val = JSON.stringify(val);
          }
          params.push(val);
        }
      }

      const sql = `INSERT INTO "${t}" (${colList}) VALUES ${values.join(", ")}`;
      try {
        await supa.query(sql, params);
        inserted += batch.length;
      } catch (err) {
        console.error(`  ✗ ${t} batch at row ${i}: ${err.message}`);
        // Try one by one for this batch to find the problem row
        for (const row of batch) {
          const singlePlaceholders = columns.map((_, idx) => `$${idx + 1}`);
          const singleParams = columns.map((col) => {
            let val = row[col];
            if (val !== null && typeof val === "object" && !(val instanceof Date) && !Array.isArray(val)) {
              val = JSON.stringify(val);
            }
            return val;
          });
          try {
            await supa.query(
              `INSERT INTO "${t}" (${colList}) VALUES (${singlePlaceholders.join(", ")})`,
              singleParams
            );
            inserted++;
          } catch (rowErr) {
            console.error(`    Row error: ${rowErr.message}`);
          }
        }
      }
    }
    console.log(`  ✓ ${t}: ${inserted}/${rows.length} rows`);
  }

  // Re-enable FK checks
  await supa.query("SET session_replication_role = 'origin'");
  console.log("\n  (FK checks re-enabled)");

  // Reset sequences
  console.log("\n  Resetting sequences...");
  const sequences = await getSequences(neon);
  for (const seq of sequences) {
    try {
      // Find the table/column this sequence belongs to
      const seqVal = await neon.query(
        `SELECT last_value FROM "${seq.sequence_name}"`
      );
      const lastVal = seqVal.rows[0].last_value;
      await supa.query(
        `SELECT setval('"${seq.sequence_name}"', ${lastVal}, true)`
      );
      console.log(`  ✓ ${seq.sequence_name} = ${lastVal}`);
    } catch (err) {
      // Sequence may not exist on target if using uuid defaults
      console.log(`  - ${seq.sequence_name}: ${err.message}`);
    }
  }

  // Create indexes
  console.log("\n  Creating indexes...");
  for (const t of ordered) {
    const indexes = await getIndexes(neon, t);
    for (const idx of indexes) {
      try {
        await supa.query(idx.indexdef);
        console.log(`  ✓ ${idx.indexname}`);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.error(`  ✗ ${idx.indexname}: ${err.message}`);
        }
      }
    }
  }

  // --- Verify ---
  console.log("\n[7/7] Verifying migration...\n");

  let errors = 0;
  for (const t of tables) {
    const supaCount = await getTableCount(supa, t).catch(() => -1);
    const neonCount = tableCounts[t];
    if (supaCount === neonCount) {
      console.log(`  ✓ ${t}: ${neonCount} rows`);
    } else {
      console.log(`  ✗ ${t}: Neon=${neonCount}, Supabase=${supaCount} (MISMATCH)`);
      errors++;
    }
  }

  // --- Done ---
  await neon.end();
  await supa.end();

  console.log("\n=========================================");
  if (errors === 0) {
    console.log("  Migration Complete — All tables verified!");
  } else {
    console.log(`  Migration Complete — ${errors} table(s) with mismatches`);
  }
  console.log("=========================================\n");
  console.log("Next steps:\n");
  console.log("  1. Update .env:");
  console.log(`     DATABASE_URL=${SUPABASE_URL}\n`);
  console.log("  2. Verify Drizzle schema:");
  console.log("     npx drizzle-kit check\n");
  console.log("  3. Test your app against the new database.\n");
  console.log("  4. Update Vercel/deployment env vars.\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
