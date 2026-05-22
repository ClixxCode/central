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

type ScopeSource = 'catalog' | 'sow' | 'merged';

interface ServiceTask {
  phase: string | null;
  title: string;
}

interface Service {
  name: string;
  catalog_id: string | null;
  onboarding_scope: string | null;
  accesses_required: string | null;
  onboarding_tasks?: ServiceTask[];
  task_source?: ScopeSource;
  task_source_reasoning?: string;
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

interface UpsertResult {
  id: string;
  defaultBoardId: string | null;
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

function serviceSectionId(serviceName: string): string {
  return (
    'service-' +
    serviceName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  );
}

const SERVICE_SECTION_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

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
    const client = await upsertClient(payload);
    const boardId = await provisionOnboardingBoard(client.id, client.defaultBoardId, payload);

    if (!client.defaultBoardId) {
      await db
        .update(clients)
        .set({ defaultBoardId: boardId })
        .where(eq(clients.id, client.id));
    }

    return NextResponse.json({
      central_client_id: client.id,
      central_board_id: boardId,
    });
  } catch (error) {
    console.error('[pulse-webhook] processing failed', error);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

async function upsertClient(payload: PulseClientOnboardedPayload): Promise<UpsertResult> {
  // Lookup by slug first; fall back to lookup by pulse_account_id stored on
  // metadata. The fallback catches the case where Pulse's slug derivation
  // changed (e.g. earlier conversions wrote slug = account UUID due to the
  // business_name bug, then later conversions started sending the real
  // slug). Without the fallback we'd create a duplicate client every time
  // the slug shifts; with it, we update the existing row in place.
  let existing = await db.query.clients.findFirst({
    where: eq(clients.slug, payload.account_slug),
    columns: { id: true, name: true, slug: true, metadata: true, defaultBoardId: true },
  });

  if (!existing) {
    const candidates = await db.query.clients.findMany({
      columns: { id: true, name: true, slug: true, metadata: true, defaultBoardId: true },
    });
    existing =
      candidates.find(
        (c) =>
          (c.metadata as ClientMetadata | null)?.customFields?.pulse_account_id ===
          payload.pulse_account_id,
      ) ?? undefined;
  }

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
    // Sync name + slug from Pulse on every push so renames propagate. Pulse
    // is the source of truth for client identity; AMs who rename in Central
    // will see their edit reverted on the next sync, which is the intended
    // direction — changes should happen upstream.
    await db
      .update(clients)
      .set({
        name: payload.account_name,
        slug: payload.account_slug,
        metadata,
      })
      .where(eq(clients.id, existing.id));
    return { id: existing.id, defaultBoardId: existing.defaultBoardId ?? null };
  }

  const [created] = await db
    .insert(clients)
    .values({
      name: payload.account_name,
      slug: payload.account_slug,
      metadata,
    })
    .returning({ id: clients.id });
  return { id: created.id, defaultBoardId: null };
}

async function provisionOnboardingBoard(
  clientId: string,
  existingDefaultBoardId: string | null,
  payload: PulseClientOnboardedPayload,
): Promise<string> {
  const template = await db.query.boardTemplates.findFirst({
    where: eq(boardTemplates.name, ONBOARDING_TEMPLATE_NAME),
  });

  const clientBoards = await db.query.boards.findMany({
    where: eq(boards.clientId, clientId),
    columns: {
      id: true,
      name: true,
      statusOptions: true,
      sectionOptions: true,
    },
    orderBy: [asc(boards.createdAt)],
  });

  const target =
    clientBoards.find((b) => b.id === existingDefaultBoardId) ?? clientBoards[0] ?? null;

  const serviceSections: SectionOption[] = payload.services.map((s, i) => ({
    id: serviceSectionId(s.name),
    label: s.name,
    color: SERVICE_SECTION_COLORS[i % SERVICE_SECTION_COLORS.length],
    position: i,
  }));

  if (target) {
    const merged = mergeSectionOptions(
      (target.sectionOptions as SectionOption[] | null) ?? [],
      [
        ...((template?.sectionOptions as SectionOption[] | null) ?? []),
        ...serviceSections,
      ],
    );

    // Update the board: rename if Pulse's account_name is now different,
    // and merge in any new sections. Single round-trip when either changed.
    const nameChanged = target.name !== payload.account_name;
    if (nameChanged || merged.changed) {
      const updates: Record<string, unknown> = {};
      if (nameChanged) updates.name = payload.account_name;
      if (merged.changed) updates.sectionOptions = merged.options;
      await db.update(boards).set(updates).where(eq(boards.id, target.id));
    }

    if (template) {
      await materializeTemplateTasks(
        target.id,
        template.id,
        target.statusOptions as StatusOption[],
        { dedupe: true },
      );
    }
    await materializePerServiceTasks(
      target.id,
      target.statusOptions as StatusOption[],
      payload,
      { dedupe: true },
    );
    return target.id;
  }

  const boardName = payload.account_name;
  const initialSections: SectionOption[] = template
    ? mergeSectionOptions(
        (template.sectionOptions as SectionOption[] | null) ?? [],
        serviceSections,
      ).options
    : serviceSections;

  const [newBoard] = await db
    .insert(boards)
    .values({
      clientId,
      name: boardName,
      type: 'standard',
      ...(template
        ? {
            statusOptions: template.statusOptions as StatusOption[],
            sectionOptions: initialSections,
            icon: template.icon,
            color: template.color,
          }
        : { sectionOptions: initialSections }),
    })
    .returning({ id: boards.id, statusOptions: boards.statusOptions });

  if (template) {
    await materializeTemplateTasks(
      newBoard.id,
      template.id,
      newBoard.statusOptions as StatusOption[],
      { dedupe: false },
    );
  }
  await materializePerServiceTasks(
    newBoard.id,
    newBoard.statusOptions as StatusOption[],
    payload,
    { dedupe: false },
  );

  return newBoard.id;
}

function mergeSectionOptions(
  current: SectionOption[],
  incoming: SectionOption[],
): { options: SectionOption[]; changed: boolean } {
  if (incoming.length === 0) return { options: current, changed: false };
  const byId = new Map(current.map((s) => [s.id, s]));
  let nextPosition = current.reduce((max, s) => Math.max(max, s.position), -1) + 1;
  let changed = false;
  for (const section of incoming) {
    if (byId.has(section.id)) continue;
    byId.set(section.id, { ...section, position: nextPosition++ });
    changed = true;
  }
  return { options: Array.from(byId.values()), changed };
}

async function existingTitlesOnBoard(boardId: string): Promise<Set<string>> {
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.boardId, boardId),
    columns: { title: true },
  });
  return new Set(rows.map((r) => r.title));
}

async function maxPositionOnBoard(boardId: string): Promise<number> {
  const rows = await db.query.tasks.findMany({
    where: eq(tasks.boardId, boardId),
    columns: { position: true },
  });
  return rows.reduce((max, r) => Math.max(max, r.position ?? -1), -1);
}

async function materializeTemplateTasks(
  boardId: string,
  templateId: string,
  statusOptions: StatusOption[],
  opts: { dedupe: boolean },
): Promise<void> {
  const templateRows = await db.query.templateTasks.findMany({
    where: eq(templateTasks.templateId, templateId),
    orderBy: [asc(templateTasks.position)],
  });
  if (templateRows.length === 0) return;

  const validStatusIds = new Set(statusOptions.map((s) => s.id));
  const defaultStatus = statusOptions[0]?.id ?? 'todo';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDueDate = (relativeDays: number | null): string | undefined =>
    relativeDays != null
      ? new Date(today.getTime() + relativeDays * 86_400_000).toISOString().split('T')[0]
      : undefined;

  const existingTitles = opts.dedupe ? await existingTitlesOnBoard(boardId) : new Set<string>();

  const topLevel = templateRows
    .filter((t) => !t.parentTemplateTaskId)
    .filter((t) => !existingTitles.has(t.title));
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
          status: t.status && validStatusIds.has(t.status) ? t.status : defaultStatus,
          section: t.section,
          dueDate: toDueDate(t.relativeDueDays),
          recurringConfig: t.recurringConfig as RecurringConfig | undefined,
          position: t.position,
        })),
      )
      .returning({ id: tasks.id });
    topLevel.forEach((t, i) => mapping.set(t.id, inserted[i].id));
  }

  const subs = templateRows
    .filter((t) => t.parentTemplateTaskId)
    .filter((t) => mapping.has(t.parentTemplateTaskId!))
    .filter((t) => !existingTitles.has(t.title));
  if (subs.length > 0) {
    await db.insert(tasks).values(
      subs.map((t) => ({
        boardId,
        shortId: shortId(),
        title: t.title,
        description: t.description as TiptapContent | undefined,
        status: t.status && validStatusIds.has(t.status) ? t.status : defaultStatus,
        section: t.section,
        dueDate: toDueDate(t.relativeDueDays),
        position: t.position,
        parentTaskId: mapping.get(t.parentTemplateTaskId!)!,
      })),
    );
  }
}

async function materializePerServiceTasks(
  boardId: string,
  statusOptions: StatusOption[],
  payload: PulseClientOnboardedPayload,
  opts: { dedupe: boolean },
): Promise<void> {
  const defaultStatus = statusOptions[0]?.id ?? 'todo';
  const existingTitles = opts.dedupe ? await existingTitlesOnBoard(boardId) : new Set<string>();
  let nextPosition = (await maxPositionOnBoard(boardId)) + 1;

  const rows: Array<{
    title: string;
    description: TiptapContent | undefined;
    section: string;
    position: number;
  }> = [];

  for (const service of payload.services) {
    const sectionId = serviceSectionId(service.name);
    const sourceLabel =
      service.task_source === 'sow'
        ? 'SOW-bespoke scope'
        : service.task_source === 'merged'
          ? 'Catalog default + SOW additions'
          : 'Catalog default';
    const reasoning = service.task_source_reasoning?.trim() ?? '';
    const description = buildServiceTaskDescription(sourceLabel, reasoning);

    const serviceTasks = service.onboarding_tasks ?? [];
    if (serviceTasks.length === 0) {
      const title = `Set up: ${service.name}`;
      if (!existingTitles.has(title)) {
        rows.push({ title, description, section: sectionId, position: nextPosition++ });
        existingTitles.add(title);
      }
      continue;
    }

    for (const task of serviceTasks) {
      const title = task.phase ? `${task.phase}: ${task.title}` : task.title;
      if (existingTitles.has(title)) continue;
      rows.push({ title, description, section: sectionId, position: nextPosition++ });
      existingTitles.add(title);
    }
  }

  if (rows.length === 0) return;

  await db.insert(tasks).values(
    rows.map((r) => ({
      boardId,
      shortId: shortId(),
      title: r.title,
      description: r.description,
      status: defaultStatus,
      section: r.section,
      position: r.position,
    })),
  );
}

function buildServiceTaskDescription(
  sourceLabel: string,
  reasoning: string,
): TiptapContent {
  const content: TiptapContent['content'] = [
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Source: ' },
        { type: 'text', text: sourceLabel },
      ],
    },
  ];
  if (reasoning) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: reasoning }],
    });
  }
  return { type: 'doc', content };
}
