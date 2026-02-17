import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comments, tasks, boards, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  const result = await db
    .select({
      commentId: comments.id,
      taskId: tasks.id,
      boardId: boards.id,
      clientSlug: clients.slug,
    })
    .from(comments)
    .innerJoin(tasks, eq(comments.taskId, tasks.id))
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(eq(comments.shortId, shortId))
    .limit(1);

  if (result.length === 0) {
    return new NextResponse('Comment not found', { status: 404 });
  }

  const { commentId, taskId, clientSlug, boardId } = result[0];
  const redirectUrl = `/clients/${clientSlug}/boards/${boardId}?task=${taskId}&comment=${commentId}`;

  return NextResponse.redirect(new URL(redirectUrl, request.url), 302);
}
