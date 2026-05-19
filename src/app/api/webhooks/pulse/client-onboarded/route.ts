import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  boardTemplates,
  boards,
  clients,
  templateTasks,
  tasks,
} from '@/lib/db/schema';
import type {
  StatusOption,
  SectionOption,
  TiptapContent,
  RecurringConfig,
  ClientMetadata,
} from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Health probe so we can verify deployment without sending a signed payload.
// curl https://central.clix.co/api/webhooks/pulse/client-onboarded
// → 200 { ok: true } when the route is live; 405 from Vercel otherwise.
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: 'pulse/client-onboarded',
    method: 'POST',
    secret_configured: !!process.env.CENTRAL_WEBHOOK_SECRET,
  });
}

const ONBOARDING_TEMPLATE_NAME = 'New Client Onboarding';
const MAX_SKEW_SECONDS = 5 * 60;

interface Service {
  name: string;
  catalog_id: string | null;
  onboarding_scope: string | null;
  accesses_required: string | null;
}

interface PulseClientOnboardedPayload {
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
  services: Service[];
  primary_account_manager: {
    staff_id: string;
    full_name: string;
    email: string | null;
  } | null;
  pod: { id: string; name: string } | null;
}

function shortId(): string {
  return crypto.randomBytes(6).toString('base64url');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CENTRAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[pulse-webhook] CENTRAL_WEBHOOK_SECRET not configured');
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

  let payload: PulseClientOnboardedPayload;
  try {
    payload = JSON.parse(body) as PulseClientOnboardedPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!payload.account_slug || !payload.account_name || !payload.pulse_account_id) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  try {
    const clientId = await upsertClient(payload);
    const boardId = await createOnboardingBoard(clientId, payload);

    await db
      .update(clients)
      .set({ defaultBoardId: boardId })
      .where(eq(clients.id, clientId));

    return NextResponse.json({
      central_client_id: clientId,
      central_board_id: boardId,
    });
  } catch (error) {
    console.error('[pulse-webhook] processing failed', error);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

async function upsertClient(payload: PulseClientOnboardedPayload): Promise<string> {
  const existing = await db.query.clients.findFirst({
    where: eq(clients.slug, payload.account_slug),
    columns: { id: true, metadata: true },
  });

  const metadata: ClientMetadata = {
    ...(existing?.metadata ?? {}),
    industry: payload.industry ?? existing?.metadata?.industry,
    website: payload.target_website ?? existing?.metadata?.website,
    customFields: {
      ...(existing?.metadata?.customFields ?? {}),
      pulse_account_id: payload.pulse_account_id,
      pulse_sales_case_id: payload.pulse_sales_case_id,
      ...(payload.sow_number ? { sow_number: payload.sow_number } : {}),
      ...(payload.signed_mrr != null ? { signed_mrr: payload.signed_mrr } : {}),
      ...(payload.project_revenue != null ? { project_revenue: payload.project_revenue } : {}),
      ...(payload.commencement_date ? { commencement_date: payload.commencement_date } : {}),
      ...(payload.term_length ? { term_length: payload.term_length } : {}),
      ...(payload.initial_term_ends ? { initial_term_ends: payload.initial_term_ends } : {}),
      ...(payload.pod ? { pod_name: payload.pod.name } : {}),
      ...(payload.primary_account_manager
        ? { account_manager: payload.primary_account_manager.full_name }
        : {}),
    },
  };

  if (existing) {
    await db.update(clients).set({ metadata }).where(eq(clients.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(clients)
    .values({
      name: payload.account_name,
      slug: payload.account_slug,
      metadata,
    })
    .returning({ id: clients.id });
  return created.id;
}

async function createOnboardingBoard(
  clientId: string,
  payload: PulseClientOnboardedPayload,
): Promise<string> {
  const template = await db.query.boardTemplates.findFirst({
    where: eq(boardTemplates.name, ONBOARDING_TEMPLATE_NAME),
  });

  const boardName = payload.sow_number
    ? `Onboarding — ${payload.sow_number}`
    : `Onboarding — ${payload.account_name}`;

  const [newBoard] = await db
    .insert(boards)
    .values({
      clientId,
      name: boardName,
      type: 'standard',
      ...(template
        ? {
            statusOptions: template.statusOptions as StatusOption[],
            sectionOptions: template.sectionOptions as SectionOption[],
            icon: template.icon,
            color: template.color,
          }
        : {}),
    })
    .returning({ id: boards.id, statusOptions: boards.statusOptions });

  if (template) {
    await materializeTemplateTasks(newBoard.id, template.id, newBoard.statusOptions as StatusOption[]);
  } else {
    await seedFallbackTasks(newBoard.id, newBoard.statusOptions as StatusOption[], payload);
  }

  return newBoard.id;
}

async function materializeTemplateTasks(
  boardId: string,
  templateId: string,
  statusOptions: StatusOption[],
): Promise<void> {
  const templateRows = await db.query.templateTasks.findMany({
    where: eq(templateTasks.templateId, templateId),
    orderBy: [asc(templateTasks.position)],
  });
  if (templateRows.length === 0) return;

  const defaultStatus = statusOptions[0]?.id ?? 'todo';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDueDate = (relativeDays: number | null): string | undefined =>
    relativeDays != null
      ? new Date(today.getTime() + relativeDays * 86_400_000).toISOString().split('T')[0]
      : undefined;

  const topLevel = templateRows.filter((t) => !t.parentTemplateTaskId);
  const mapping = new Map<string, string>();

  if (topLevel.length > 0) {
    const inserted = await db
      .insert(tasks)
      .values(
        topLevel.map((t) => ({
          boardId,
          shortId: shortId(),
          title: t.title,
          description: t.description as TiptapContent | undefined,
          status: t.status ?? defaultStatus,
          section: t.section,
          dueDate: toDueDate(t.relativeDueDays),
          recurringConfig: t.recurringConfig as RecurringConfig | undefined,
          position: t.position,
        })),
      )
      .returning({ id: tasks.id });
    topLevel.forEach((t, i) => mapping.set(t.id, inserted[i].id));
  }

  const subs = templateRows.filter((t) => t.parentTemplateTaskId);
  if (subs.length > 0) {
    await db.insert(tasks).values(
      subs
        .filter((t) => mapping.has(t.parentTemplateTaskId!))
        .map((t) => ({
          boardId,
          shortId: shortId(),
          title: t.title,
          description: t.description as TiptapContent | undefined,
          status: t.status ?? defaultStatus,
          section: t.section,
          dueDate: toDueDate(t.relativeDueDays),
          position: t.position,
          parentTaskId: mapping.get(t.parentTemplateTaskId!)!,
        })),
    );
  }
}

async function seedFallbackTasks(
  boardId: string,
  statusOptions: StatusOption[],
  payload: PulseClientOnboardedPayload,
): Promise<void> {
  const defaultStatus = statusOptions[0]?.id ?? 'todo';
  const rows = [
    { title: 'Kickoff meeting', position: 0 },
    { title: 'Collect access credentials', position: 1 },
    ...payload.services.map((service, i) => ({
      title: `Set up: ${service.name}`,
      position: 2 + i,
    })),
  ];

  await db.insert(tasks).values(
    rows.map((r) => ({
      boardId,
      shortId: shortId(),
      title: r.title,
      status: defaultStatus,
      position: r.position,
    })),
  );
}
