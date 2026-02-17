import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import {
  tasks,
  taskAssignees,
  boards,
  boardAccess,
  clients,
  users,
  teamMembers,
} from '@/lib/db/schema';
import { eq, and, or, not, inArray, asc, sql, isNull } from 'drizzle-orm';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

// --- Helpers (mirrors logic from src/lib/actions/tasks.ts) ---

type AccessLevel = 'full' | 'assigned_only' | null;

async function isUserInContractorTeam(userId: string): Promise<boolean> {
  const rows = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  return rows.some((tm) => tm.team.excludeFromPublic);
}

async function getBoardAccessLevel(
  userId: string,
  boardId: string,
  isAdmin: boolean
): Promise<AccessLevel> {
  if (isAdmin) return 'full';

  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { type: true, createdBy: true },
  });
  if (board?.type === 'personal') return board.createdBy === userId ? 'full' : null;

  const isContractor = await isUserInContractorTeam(userId);
  if (!isContractor) return 'full';

  const directAccess = await db.query.boardAccess.findFirst({
    where: and(eq(boardAccess.boardId, boardId), eq(boardAccess.userId, userId)),
  });
  if (directAccess) return directAccess.accessLevel;

  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  if (userTeams.length === 0) return null;

  const teamAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      inArray(boardAccess.teamId, userTeams.map((t) => t.teamId))
    ),
  });
  return teamAccess?.accessLevel ?? null;
}

// --- GET: Search tasks ---

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const query = request.nextUrl.searchParams.get('search')?.trim().toLowerCase();
  if (!query || query.length < 2) {
    return NextResponse.json([], { headers });
  }

  const isAdmin = user.role === 'admin';

  const searchResults = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      boardId: boards.id,
      boardName: boards.name,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(
      and(
        sql`LOWER(${tasks.title}) LIKE ${'%' + query + '%'}`,
        isNull(tasks.parentTaskId),
        isNull(tasks.archivedAt)
      )
    )
    .orderBy(asc(tasks.title))
    .limit(20);

  // Filter by board access
  const boardAccessCache = new Map<string, AccessLevel>();
  const accessible = [];

  for (const r of searchResults) {
    let level = boardAccessCache.get(r.boardId);
    if (level === undefined) {
      level = await getBoardAccessLevel(user.id, r.boardId, isAdmin);
      boardAccessCache.set(r.boardId, level);
    }
    if (level === 'full' || level === 'assigned_only') {
      accessible.push(r);
    }
  }

  return NextResponse.json(
    accessible.map((r) => ({
      id: r.taskId,
      title: r.taskTitle,
      status: r.taskStatus,
      boardId: r.boardId,
      boardName: r.boardName,
      clientName: r.clientName,
      clientSlug: r.clientSlug,
    })),
    { headers }
  );
}

// --- POST: Create task ---

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  let body: {
    boardId: string;
    title: string;
    status?: string;
    assigneeIds?: string[];
    dueDate?: string;
    description?: string;
    conversationMeta?: {
      url?: string;
      subject?: string | null;
      sender?: string | null;
      senderEmail?: string | null;
      recipient?: string | null;
      date?: string | null;
      body?: string | null;
      preview?: string | null;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  if (!body.boardId || !body.title?.trim()) {
    return NextResponse.json({ error: 'boardId and title are required' }, { status: 400, headers });
  }

  const isAdmin = user.role === 'admin';
  const accessLevel = await getBoardAccessLevel(user.id, body.boardId, isAdmin);
  if (!accessLevel) {
    return NextResponse.json({ error: 'Access denied to this board' }, { status: 403, headers });
  }

  // Get default status from board if not provided
  let status = body.status;
  if (!status) {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, body.boardId),
      columns: { statusOptions: true },
    });
    const statusOptions = (board as any)?.statusOptions as { id: string }[] | undefined;
    status = statusOptions?.[0]?.id ?? 'todo';
  }

  // Get next position
  const maxPosResult = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
    .from(tasks)
    .where(and(eq(tasks.boardId, body.boardId), isNull(tasks.parentTaskId)));
  const position = (maxPosResult[0]?.maxPos ?? -1) + 1;

  // Build description as TiptapContent.
  // If conversationMeta is provided, render a frontConversation card node.
  // If plain description text is also provided, include it as paragraphs before the card.
  let description: any = undefined;
  const tiptapContent: any[] = [];

  if (body.description?.trim()) {
    const rawDesc = body.description.trim();
    const paragraphs = rawDesc.split(/\n\n+/);

    for (const para of paragraphs) {
      const urlPattern = /https?:\/\/[^\s]+/g;
      const nodes: any[] = [];
      let lastIndex = 0;
      let urlMatch;
      while ((urlMatch = urlPattern.exec(para)) !== null) {
        if (urlMatch.index > lastIndex) {
          nodes.push({ type: 'text', text: para.slice(lastIndex, urlMatch.index) });
        }
        nodes.push({
          type: 'text',
          text: urlMatch[0],
          marks: [{ type: 'link', attrs: { href: urlMatch[0], target: '_blank' } }],
        });
        lastIndex = urlPattern.lastIndex;
      }
      if (lastIndex < para.length) {
        nodes.push({ type: 'text', text: para.slice(lastIndex) });
      }
      tiptapContent.push({
        type: 'paragraph',
        content: nodes.length > 0 ? nodes : [{ type: 'text', text: para }],
      });
    }
  }

  if (body.conversationMeta?.url) {
    tiptapContent.push({
      type: 'frontConversation',
      attrs: {
        url: body.conversationMeta.url,
        subject: body.conversationMeta.subject || null,
        sender: body.conversationMeta.sender || null,
        senderEmail: body.conversationMeta.senderEmail || null,
        recipient: body.conversationMeta.recipient || null,
        date: body.conversationMeta.date || null,
        body: body.conversationMeta.body || body.conversationMeta.preview || null,
      },
    });
  }

  if (tiptapContent.length > 0) {
    description = { type: 'doc', content: tiptapContent };
  }

  const [newTask] = await db
    .insert(tasks)
    .values({
      boardId: body.boardId,
      title: body.title.trim(),
      status,
      position,
      dueDate: body.dueDate || undefined,
      description,
      createdBy: user.id,
    })
    .returning();

  // Add assignees if provided
  if (body.assigneeIds && body.assigneeIds.length > 0) {
    await db.insert(taskAssignees).values(
      body.assigneeIds.map((userId) => ({
        taskId: newTask.id,
        userId,
      }))
    );
  }

  return NextResponse.json(
    { id: newTask.id, title: newTask.title, status: newTask.status },
    { status: 201, headers }
  );
}
