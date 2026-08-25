import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { oauthRateLimits } from '@/lib/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { digestToken } from './crypto';
import { OAuthRequestError } from './http';

const WINDOW_MS = 60_000;

export async function enforceOAuthRateLimit(bucket: string, limit: number): Promise<void> {
  const headerStore = await headers();
  const forwarded = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = digestToken(`${bucket}:${forwarded ?? headerStore.get('x-real-ip') ?? 'unknown'}`);
  const windowStartedAt = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);

  const [row] = await db
    .insert(oauthRateLimits)
    .values({ keyHash: key, bucket, windowStartedAt, count: 1 })
    .onConflictDoUpdate({
      target: [oauthRateLimits.keyHash, oauthRateLimits.bucket, oauthRateLimits.windowStartedAt],
      set: { count: sql`${oauthRateLimits.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: oauthRateLimits.count });

  if (Math.random() < 0.01) {
    void db
      .delete(oauthRateLimits)
      .where(and(eq(oauthRateLimits.bucket, bucket), lt(oauthRateLimits.updatedAt, new Date(Date.now() - 86_400_000))))
      .catch(() => {});
  }

  if ((row?.count ?? 1) > limit) {
    throw new OAuthRequestError('slow_down', 'Too many OAuth requests; retry later', 429);
  }
}
