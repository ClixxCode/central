import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients, boards, statuses, sections } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { verifyPulseSignature } from '@/lib/pulse/webhook-verify';
import { inngest } from '@/lib/inngest/client';

export const maxDuration = 60;

interface PulsePayload {
  pulse_account_id: string;
  pulse_sales_case_id: string;
  account_name: string;
  account_slug: string;
  industry: string | null;
  target_website: string | null;
  sow_number: string | null;
  sow_pdf_url: string | null;
  commencement_date: string | null;
  term_length: string | null;
  initial_term_ends: string | null;
  signed_mrr: number | null;
  project_revenue: number | null;
  services: Array<{
    name: string;
    catalog_id: string | null;
    onboarding_scope: string | null;
    accesses_required: string | null;
  }>;
  primary_account_manager: {
    staff_id: string;
    full_name: string;
    email: string | null;
  } | null;
  pod: { id: string; name: string } | null;
}

/**
 * POST /api/webhooks/pulse/client-onboarded
 *
 * Called by Pulse after a human confirms a signed SOW's extracted fields.
 * We create (or update in place) a Central `client` + default `board` and
 * fire an Inngest event to generate onboarding tasks.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PULSE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'PULSE_WEBHOOK_SECRET not configured' },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const verification = verifyPulseSignature({
    rawBody,
    signature: req.headers.get('x-pulse-signature'),
    timestamp: req.headers.get('x-pulse-timestamp'),
    secret,
  });
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  let payload: PulsePayload;
  try {
    payload = JSON.parse(rawBody) as PulsePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.pulse_account_id || !payload.account_name || !payload.account_slug) {
    return NextResponse.json(
      { error: 'pulse_account_id, account_name, account_slug required' },
      { status: 400 },
    );
  }

  // Idempotency: if a client with this pulse_account_id already exists,
  // return the existing IDs and skip creation.
  const existing = await db.query.clients.findFirst({
    where: sql`${clients.metadata}->>'pulse_account_id' = ${payload.pulse_account_id}`,
  });
  if (existing) {
    return NextResponse.json({
      central_client_id: existing.id,
      central_board_id: existing.defaultBoardId,
      already_existed: true,
    });
  }

  const [globalStatuses, globalSections] = await Promise.all([
    db.query.statuses.findMany({ orderBy: [asc(statuses.position)] }),
    db.query.sections.findMany({ orderBy: [asc(sections.position)] }),
  ]);
  const boardStatusOptions = globalStatuses.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    position: s.position,
  }));
  const boardSectionOptions = globalSections.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    position: s.position,
  }));

  // Ensure slug uniqueness: append short pulse id if collision.
  let slug = payload.account_slug;
  const slugTaken = await db.query.clients.findFirst({
    where: eq(clients.slug, slug),
  });
  if (slugTaken) {
    slug = `${slug}-${payload.pulse_account_id.slice(0, 8)}`;
  }

  const [newClient] = await db
    .insert(clients)
    .values({
      name: payload.account_name,
      slug,
      metadata: {
        industry: payload.industry ?? undefined,
        website: payload.target_website ?? undefined,
        notes: payload.pod ? `Pod: ${payload.pod.name}` : undefined,
        customFields: {
          pulse_account_id: payload.pulse_account_id,
          pulse_sales_case_id: payload.pulse_sales_case_id,
          sow_number: payload.sow_number ?? '',
          sow_pdf_url: payload.sow_pdf_url ?? '',
          commencement_date: payload.commencement_date ?? '',
          term_length: payload.term_length ?? '',
          initial_term_ends: payload.initial_term_ends ?? '',
          signed_mrr: payload.signed_mrr ?? 0,
          project_revenue: payload.project_revenue ?? 0,
          primary_am_email: payload.primary_account_manager?.email ?? '',
          primary_am_name: payload.primary_account_manager?.full_name ?? '',
        },
      } as Record<string, unknown>,
    })
    .returning();

  const [defaultBoard] = await db
    .insert(boards)
    .values({
      clientId: newClient.id,
      name: payload.account_name,
      type: 'standard',
      statusOptions:
        boardStatusOptions.length > 0 ? boardStatusOptions : undefined,
      sectionOptions: boardSectionOptions,
    })
    .returning();

  await db
    .update(clients)
    .set({ defaultBoardId: defaultBoard.id })
    .where(eq(clients.id, newClient.id));

  // Fire-and-forget: AI-driven task generation runs async via Inngest.
  // For now this is a stub that inserts a placeholder task; the real PM-agent
  // prompt + service-catalog reasoning lands in a follow-on.
  await inngest.send({
    name: 'pulse/onboarding.tasks.requested',
    data: {
      centralClientId: newClient.id,
      centralBoardId: defaultBoard.id,
      pulseAccountId: payload.pulse_account_id,
      accountName: payload.account_name,
      targetWebsite: payload.target_website,
      services: payload.services,
    },
  });

  return NextResponse.json({
    central_client_id: newClient.id,
    central_board_id: defaultBoard.id,
    already_existed: false,
  });
}
