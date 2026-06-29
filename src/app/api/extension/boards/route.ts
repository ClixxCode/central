import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import { boards } from '@/lib/db/schema';
import type { StatusOption } from '@/lib/db/schema';
import { and, inArray, not } from 'drizzle-orm';
import { getExplicitAccessBoardIds, isUserInContractorTeam } from '@/lib/actions/board-access';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

function mapBoard(b: {
  id: string;
  name: string;
  statusOptions: StatusOption[];
  client?: { name: string; slug?: string | null } | null;
}) {
  return {
    id: b.id,
    name: b.name,
    clientName: b.client?.name ?? null,
    clientSlug: b.client?.slug ?? null,
    statusOptions: (b.statusOptions ?? []).map((s) => ({
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

  const excludeNestedBoardTypes = not(inArray(boards.type, ['personal', 'project']));

  if (user.role === 'admin') {
    const allBoards = await db.query.boards.findMany({
      where: excludeNestedBoardTypes,
      with: { client: { columns: { id: true, name: true, slug: true } } },
      orderBy: (boards, { asc }) => [asc(boards.name)],
    });

    return NextResponse.json(allBoards.map(mapBoard), { headers });
  }

  // Check if contractor
  const isContractor = await isUserInContractorTeam(user.id);

  if (!isContractor) {
    const allBoards = await db.query.boards.findMany({
      where: excludeNestedBoardTypes,
      with: { client: { columns: { id: true, name: true, slug: true } } },
      orderBy: (boards, { asc }) => [asc(boards.name)],
    });

    return NextResponse.json(allBoards.map(mapBoard), { headers });
  }

  // Contractor: only explicitly accessible boards
  const accessibleIds = await getExplicitAccessBoardIds(user.id);

  if (accessibleIds.length === 0) {
    return NextResponse.json([], { headers });
  }

  const accessibleBoards = await db.query.boards.findMany({
    where: and(inArray(boards.id, accessibleIds), excludeNestedBoardTypes),
    with: { client: { columns: { id: true, name: true, slug: true } } },
    orderBy: (boards, { asc }) => [asc(boards.name)],
  });

  return NextResponse.json(accessibleBoards.map(mapBoard), { headers });
}
