import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import type { ClientMetadata, AccountTeamMember } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SKEW_SECONDS = 5 * 60;

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: 'pulse/account-updated',
    method: 'POST',
    secret_configured: !!process.env.CENTRAL_WEBHOOK_SECRET,
  });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

interface AccountSnapshot {
  id: string;
  business_name: string;
  slug: string;
  account_type: string | null;
  account_status: string | null;
  termination_date: string | null;
  pod: { id: string; name: string; sub_context: string | null } | null;
  team: AccountTeamMember[];
  updated_at: string | null;
}

interface AccountUpdatedPayload {
  event: 'created' | 'updated' | 'deleted';
  account_id: string;
  snapshot: AccountSnapshot | null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CENTRAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[pulse-account] CENTRAL_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('x-pulse-signature');
  const timestamp = request.headers.get('x-pulse-timestamp');
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SECONDS) {
    return NextResponse.json({ error: 'stale timestamp' }, { status: 401 });
  }

  const body = await request.text();
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  if (!timingSafeEqualHex(signature, expected)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: AccountUpdatedPayload;
  try {
    payload = JSON.parse(body) as AccountUpdatedPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const snapshot = payload.snapshot;
  if (!payload.account_id || !snapshot) {
    return NextResponse.json({ error: 'missing snapshot' }, { status: 400 });
  }

  try {
    // Match by the Pulse account id (column first, metadata fallback), then by
    // slug. We only reflect onto EXISTING Central clients — we never create one
    // here (clients are provisioned by the SOW onboarding bridge).
    let existing = await db.query.clients.findFirst({
      where: eq(clients.pulseAccountId, snapshot.id),
      columns: { id: true },
    });

    if (!existing) {
      existing = await db.query.clients.findFirst({
        where: eq(clients.slug, snapshot.slug),
        columns: { id: true },
      });
    }

    if (!existing) {
      const candidates = await db.query.clients.findMany({
        columns: { id: true, metadata: true },
      });
      const match = candidates.find(
        (c) =>
          (c.metadata as ClientMetadata | null)?.customFields?.pulse_account_id === snapshot.id,
      );
      existing = match ? { id: match.id } : undefined;
    }

    if (!existing) {
      // Not a Central client (or not onboarded yet) — nothing to reflect.
      return NextResponse.json({ ok: true, matched: false });
    }

    const team = Array.isArray(snapshot.team) ? snapshot.team : [];
    await db
      .update(clients)
      .set({
        pulseAccountId: snapshot.id,
        accountStatus: snapshot.account_status,
        accountType: snapshot.account_type,
        podName: snapshot.pod?.name ?? null,
        podSubContext: snapshot.pod?.sub_context ?? null,
        accountTeam: team,
        pulseSyncedAt: new Date(),
      })
      .where(eq(clients.id, existing.id));

    return NextResponse.json({ ok: true, matched: true, client_id: existing.id });
  } catch (error) {
    console.error('[pulse-account] processing failed', error);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
