import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';
import { randomBytes } from 'crypto';

// Load .env manually
const envPath = resolve(process.cwd(), '.env');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = (match[2] ?? '').replace(/^["']|["']$/g, '');
  }
}

const sql = postgres(process.env.DATABASE_URL!);

function generateShortId(): string {
  return randomBytes(6).toString('base64url'); // 8 URL-safe chars
}

async function backfill() {
  console.log('Backfilling short IDs for comments...');

  const commentsWithoutShortId = await sql`SELECT id FROM comments WHERE short_id IS NULL`;

  console.log(`Found ${commentsWithoutShortId.length} comments without short IDs`);

  let updated = 0;
  for (const comment of commentsWithoutShortId) {
    const shortId = generateShortId();
    await sql`UPDATE comments SET short_id = ${shortId} WHERE id = ${comment.id} AND short_id IS NULL`;
    updated++;
  }

  console.log(`Updated ${updated} comments with short IDs`);
  await sql.end();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
