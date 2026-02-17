import postgres from 'postgres';
import { randomBytes } from 'crypto';

const sql = postgres(process.env.DATABASE_URL!);

function generateShortId(): string {
  return randomBytes(6).toString('base64url'); // 8 URL-safe chars
}

async function backfill() {
  console.log('Backfilling short IDs for tasks...');

  const tasksWithoutShortId = await sql`SELECT id FROM tasks WHERE short_id IS NULL`;

  console.log(`Found ${tasksWithoutShortId.length} tasks without short IDs`);

  let updated = 0;
  for (const task of tasksWithoutShortId) {
    const shortId = generateShortId();
    await sql`UPDATE tasks SET short_id = ${shortId} WHERE id = ${task.id} AND short_id IS NULL`;
    updated++;
  }

  console.log(`Updated ${updated} tasks with short IDs`);
  await sql.end();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
