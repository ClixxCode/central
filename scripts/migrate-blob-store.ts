/**
 * Migrate Vercel Blob Store
 *
 * Copies all blobs from a source store to a destination store,
 * then updates all database references (attachments.url, users.avatarUrl)
 * to point to the new blob URLs.
 *
 * Usage:
 *   SOURCE_BLOB_TOKEN=vercel_blob_xxx DEST_BLOB_TOKEN=vercel_blob_yyy npx tsx scripts/migrate-blob-store.ts
 *
 * Options:
 *   --dry-run    List what would be migrated without making changes
 *   --skip-db    Only copy blobs, don't update database URLs
 *   --db-only    Only update database URLs (blobs already copied)
 */

// Load .env BEFORE any other imports so DATABASE_URL is available
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { list, put, type ListBlobResult } from '@vercel/blob';
import { eq } from 'drizzle-orm';

const SOURCE_TOKEN = process.env.SOURCE_BLOB_TOKEN;
const DEST_TOKEN = process.env.DEST_BLOB_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_DB = process.argv.includes('--skip-db');
const DB_ONLY = process.argv.includes('--db-only');
const CONCURRENCY = 5;

if (!SOURCE_TOKEN || !DEST_TOKEN) {
  console.error('Error: SOURCE_BLOB_TOKEN and DEST_BLOB_TOKEN environment variables are required.');
  console.error('Usage: SOURCE_BLOB_TOKEN=xxx DEST_BLOB_TOKEN=yyy npx tsx scripts/migrate-blob-store.ts');
  process.exit(1);
}

interface BlobItem {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
}

/** Dynamically import DB modules (must happen after env is loaded) */
async function getDb() {
  const { db } = await import('../src/lib/db');
  const { attachments } = await import('../src/lib/db/schema/attachments');
  const { users } = await import('../src/lib/db/schema/users');
  return { db, attachments, users };
}

/** List all blobs from a store (handles pagination) */
async function listAllBlobs(token: string): Promise<BlobItem[]> {
  const blobs: BlobItem[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result: ListBlobResult = await list({
      token,
      limit: 1000,
      cursor,
    });

    for (const blob of result.blobs) {
      blobs.push({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      });
    }

    hasMore = result.hasMore;
    cursor = result.cursor;
  }

  return blobs;
}

/** Download a blob by URL and return the response body */
async function downloadBlob(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response;
}

/** Upload a blob to the destination store */
async function uploadToDestination(pathname: string, body: ReadableStream | Buffer, contentType?: string): Promise<string> {
  const blob = await put(pathname, body, {
    access: 'public',
    addRandomSuffix: false,
    token: DEST_TOKEN!,
    ...(contentType && { contentType }),
  });
  return blob.url;
}

/** Process blobs with limited concurrency */
async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Update database URLs from old blob store to new blob store */
async function updateDatabaseUrls(urlMap: Map<string, string>): Promise<{ attachmentsUpdated: number; avatarsUpdated: number }> {
  const { db, attachments, users } = await getDb();
  let attachmentsUpdated = 0;
  let avatarsUpdated = 0;

  // Update attachments table
  for (const [oldUrl, newUrl] of urlMap) {
    const result = await db
      .update(attachments)
      .set({ url: newUrl })
      .where(eq(attachments.url, oldUrl));

    const count = (result as any).rowCount ?? (result as any).changes ?? 0;
    attachmentsUpdated += count;
  }

  // Update users avatarUrl
  for (const [oldUrl, newUrl] of urlMap) {
    const result = await db
      .update(users)
      .set({ avatarUrl: newUrl })
      .where(eq(users.avatarUrl, oldUrl));

    const count = (result as any).rowCount ?? (result as any).changes ?? 0;
    avatarsUpdated += count;
  }

  return { attachmentsUpdated, avatarsUpdated };
}

async function main() {
  console.log('Vercel Blob Store Migration');
  console.log('==========================');
  if (DRY_RUN) console.log('DRY RUN - no changes will be made\n');
  if (SKIP_DB) console.log('SKIP DB - database URLs will not be updated\n');
  if (DB_ONLY) console.log('DB ONLY - skipping blob copy, updating database URLs only\n');

  // Step 1: List all blobs in source store
  console.log('Listing blobs in source store...');
  const sourceBlobs = await listAllBlobs(SOURCE_TOKEN!);
  console.log(`Found ${sourceBlobs.length} blobs in source store.`);

  if (sourceBlobs.length === 0) {
    console.log('Nothing to migrate.');
    process.exit(0);
  }

  const totalSize = sourceBlobs.reduce((sum, b) => sum + b.size, 0);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  if (DRY_RUN) {
    console.log('Blobs that would be migrated:');
    for (const blob of sourceBlobs) {
      console.log(`  ${blob.pathname} (${(blob.size / 1024).toFixed(1)} KB)`);
    }
    console.log(`\nDry run complete. ${sourceBlobs.length} blobs would be migrated.`);
    process.exit(0);
  }

  const urlMap = new Map<string, string>();

  if (DB_ONLY) {
    // In db-only mode, list destination blobs and build URL map by matching pathnames
    console.log('Listing blobs in destination store...');
    const destBlobs = await listAllBlobs(DEST_TOKEN!);
    console.log(`Found ${destBlobs.length} blobs in destination store.`);

    const destByPathname = new Map(destBlobs.map((b) => [b.pathname, b.url]));

    for (const srcBlob of sourceBlobs) {
      const destUrl = destByPathname.get(srcBlob.pathname);
      if (destUrl) {
        urlMap.set(srcBlob.url, destUrl);
      } else {
        console.warn(`  WARNING: No destination blob found for ${srcBlob.pathname}`);
      }
    }
    console.log(`Matched ${urlMap.size}/${sourceBlobs.length} blobs by pathname.`);
  } else {
    // Step 2: Copy blobs from source to destination
    console.log('Copying blobs to destination store...');
    let completed = 0;
    let failed = 0;

    // List existing destination blobs to skip already-copied files
    console.log('Checking destination store for existing blobs...');
    const destBlobs = await listAllBlobs(DEST_TOKEN!);
    const existingPathnames = new Set(destBlobs.map((b) => b.pathname));
    const destByPathname = new Map(destBlobs.map((b) => [b.pathname, b.url]));

    const toUpload = sourceBlobs.filter((b) => !existingPathnames.has(b.pathname));
    const alreadyCopied = sourceBlobs.filter((b) => existingPathnames.has(b.pathname));

    // Build URL map for already-copied blobs
    for (const blob of alreadyCopied) {
      urlMap.set(blob.url, destByPathname.get(blob.pathname)!);
    }

    if (alreadyCopied.length > 0) {
      console.log(`  ${alreadyCopied.length} blobs already exist in destination, skipping.`);
    }
    console.log(`  ${toUpload.length} blobs to copy.\n`);

    await processInBatches(toUpload, CONCURRENCY, async (blob) => {
      try {
        const response = await downloadBlob(blob.url);
        const contentType = response.headers.get('content-type') ?? undefined;
        const buffer = Buffer.from(await response.arrayBuffer());
        const newUrl = await uploadToDestination(blob.pathname, buffer, contentType);

        urlMap.set(blob.url, newUrl);
        completed++;

        if (completed % 10 === 0 || completed === toUpload.length) {
          console.log(`  Progress: ${completed}/${toUpload.length} blobs copied`);
        }
      } catch (error) {
        failed++;
        console.error(`  FAILED: ${blob.pathname} - ${error}`);
      }
    });

    console.log(`\nCopy complete: ${completed} succeeded, ${failed} failed.`);
    if (failed > 0) {
      console.log(`WARNING: ${failed} blob(s) failed to copy. Review errors above.`);
    }
  }

  // Step 3: Update database URLs
  if (SKIP_DB) {
    console.log('Skipping database updates (--skip-db flag).');
  } else if (urlMap.size > 0) {
    console.log('\nUpdating database URLs...');
    const { attachmentsUpdated, avatarsUpdated } = await updateDatabaseUrls(urlMap);
    console.log(`  Attachments updated: ${attachmentsUpdated}`);
    console.log(`  Avatars updated: ${avatarsUpdated}`);
  }

  // Step 4: Print URL mapping for reference
  console.log('\n--- URL Mapping ---');
  for (const [oldUrl, newUrl] of urlMap) {
    console.log(`  ${oldUrl}`);
    console.log(`  -> ${newUrl}\n`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
