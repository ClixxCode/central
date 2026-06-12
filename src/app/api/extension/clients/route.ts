import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { mapClientForSummit } from '@/lib/clients/summit-sync';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  const allClients = await db.query.clients.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
      color: true,
      icon: true,
      metadata: true,
      leadUserId: true,
      defaultBoardId: true,
      createdAt: true,
    },
    orderBy: [asc(clients.name)],
  });

  return NextResponse.json(allClients.map(mapClientForSummit), { headers });
}
