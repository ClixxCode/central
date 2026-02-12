import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import { users, teams, teamMembers, boardAccess } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const boardId = request.nextUrl.searchParams.get('boardId');
  if (!boardId) {
    return NextResponse.json({ error: 'boardId is required' }, { status: 400, headers });
  }

  // Get all active users
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  // Get contractor team IDs
  const contractorTeams = await db.query.teams.findMany({
    where: eq(teams.excludeFromPublic, true),
    columns: { id: true },
  });
  const contractorTeamIds = new Set(contractorTeams.map((t) => t.id));

  // Get all team memberships
  const allTeamMemberships = await db.query.teamMembers.findMany({
    columns: { userId: true, teamId: true },
  });

  // Identify contractor users
  const contractorUserIds = new Set(
    allTeamMemberships
      .filter((tm) => contractorTeamIds.has(tm.teamId))
      .map((tm) => tm.userId)
  );

  // Get contractors with explicit board access
  const contractorsWithAccess = new Set<string>();

  const directAccess = await db.query.boardAccess.findMany({
    where: eq(boardAccess.boardId, boardId),
    columns: { userId: true, teamId: true },
  });

  for (const access of directAccess) {
    if (access.userId && contractorUserIds.has(access.userId)) {
      contractorsWithAccess.add(access.userId);
    }
    if (access.teamId && contractorTeamIds.has(access.teamId)) {
      for (const tm of allTeamMemberships) {
        if (tm.teamId === access.teamId) {
          contractorsWithAccess.add(tm.userId);
        }
      }
    }
  }

  // Filter: include non-contractors + contractors with access
  const assignableUsers = allUsers.filter(
    (u) => !contractorUserIds.has(u.id) || contractorsWithAccess.has(u.id)
  );

  return NextResponse.json(
    assignableUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
    })),
    { headers }
  );
}
