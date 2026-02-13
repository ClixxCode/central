import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const maxDuration = 300;

const TABLES = [
  'users',
  'teams',
  'statuses',
  'sections',
  'site_settings',
  'accounts',
  'email_verification_tokens',
  'password_reset_tokens',
  'extension_tokens',
  'google_calendar_connections',
  'invitations',
  'clients',
  'boards',
  'board_templates',
  'team_members',
  'board_access',
  'rollup_sources',
  'rollup_owners',
  'rollup_invitations',
  'favorites',
  'tasks',
  'task_assignees',
  'template_tasks',
  'comments',
  'front_conversations',
  'task_views',
  'board_activity_log',
  'attachments',
  'notifications',
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const source = postgres(process.env.DATABASE_URL!, { prepare: false });
  const target = postgres(process.env.BACKUP_DATABASE_URL!, { prepare: false });

  try {
    const rowCounts: Record<string, number> = {};

    await target.begin(async (tx) => {
      // Disable FK triggers so we can truncate/insert freely
      await tx.unsafe('SET session_replication_role = \'replica\'');

      // Truncate all tables in one statement
      await tx.unsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);

      // Copy each table
      for (const table of TABLES) {
        const rows = await source.unsafe(`SELECT * FROM "${table}"`);

        if (rows.length === 0) {
          rowCounts[table] = 0;
          continue;
        }

        // Batch insert in chunks of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const columns = Object.keys(batch[0]);
          const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

          // Build parameterized VALUES clause
          const valueClauses: string[] = [];
          const params: unknown[] = [];
          let paramIndex = 1;

          for (const row of batch) {
            const placeholders = columns.map(() => `$${paramIndex++}`);
            valueClauses.push(`(${placeholders.join(', ')})`);
            for (const col of columns) {
              params.push(row[col]);
            }
          }

          await tx.unsafe(
            `INSERT INTO "${table}" (${quotedColumns}) VALUES ${valueClauses.join(', ')}`,
            params as (string | number | boolean | null | Date)[]
          );
        }

        rowCounts[table] = rows.length;
      }

      // Re-enable FK triggers
      await tx.unsafe('SET session_replication_role = \'DEFAULT\'');
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      rowCounts,
      totalRows: Object.values(rowCounts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error('Backup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    await source.end();
    await target.end();
  }
}
