import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tasks, boards, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  const result = await db
    .select({
      taskId: tasks.id,
      boardId: boards.id,
      clientSlug: clients.slug,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(eq(tasks.shortId, shortId))
    .limit(1);

  if (result.length === 0) {
    return new NextResponse('Task not found', { status: 404 });
  }

  const { taskId, boardId, clientSlug } = result[0];
  let redirectUrl = `/clients/${clientSlug}/boards/${boardId}?task=${taskId}`;

  // Preserve comment query param if present
  const comment = request.nextUrl.searchParams.get('comment');
  if (comment) {
    redirectUrl += `&comment=${comment}`;
  }

  return NextResponse.redirect(new URL(redirectUrl, request.url), 302);
}
