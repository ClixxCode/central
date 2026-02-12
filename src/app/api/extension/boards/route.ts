import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import { boards, boardAccess, teamMembers } from '@/lib/db/schema';
import { eq, and, not, inArray, or } from 'drizzle-orm';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

function mapBoard(b: { id: string; name: string; statusOptions: any; client?: { name: string; slug?: string } | null }) {
  return {
    id: b.id,
    name: b.name,
    clientName: b.client?.name ?? null,
    clientSlug: b.client?.slug ?? null,
    statusOptions: (b.statusOptions as any[] ?? []).map((s: any) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      position: s.position,
    })),
  };
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const excludePersonal = not(eq(boards.type, 'personal'));

  if (user.role === 'admin') {
    const allBoards = await db.query.boards.findMany({
      where: excludePersonal,
      with: { client: { columns: { id: true, name: true, slug: true } } },
      orderBy: (boards, { asc }) => [asc(boards.name)],
    });

    return NextResponse.json(allBoards.map(mapBoard), { headers });
  }

  // Check if contractor
  const userTeamsWithDetails = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, user.id),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  const isContractor = userTeamsWithDetails.some((tm) => tm.team.excludeFromPublic);

  if (!isContractor) {
    const allBoards = await db.query.boards.findMany({
      where: excludePersonal,
      with: { client: { columns: { id: true, name: true, slug: true } } },
      orderBy: (boards, { asc }) => [asc(boards.name)],
    });

    return NextResponse.json(allBoards.map(mapBoard), { headers });
  }

  // Contractor: only explicitly accessible boards
  const teamIds = userTeamsWithDetails.map((t) => t.teamId);
  const conditions = [eq(boardAccess.userId, user.id)];
  if (teamIds.length > 0) {
    conditions.push(inArray(boardAccess.teamId, teamIds));
  }

  const accessEntries = await db.query.boardAccess.findMany({
    where: or(...conditions),
    columns: { boardId: true },
  });
  const accessibleIds = [...new Set(accessEntries.map((a) => a.boardId))];

  if (accessibleIds.length === 0) {
    return NextResponse.json([], { headers });
  }

  const accessibleBoards = await db.query.boards.findMany({
    where: and(inArray(boards.id, accessibleIds), excludePersonal),
    with: { client: { columns: { id: true, name: true, slug: true } } },
    orderBy: (boards, { asc }) => [asc(boards.name)],
  });

  return NextResponse.json(accessibleBoards.map(mapBoard), { headers });
}
