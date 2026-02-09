import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { getBoard, canUserEditBoard } from '@/lib/actions/boards';
import { db } from '@/lib/db';
import { boards, clients } from '@/lib/db/schema';
import { BoardPageClient } from '@/components/tasks/BoardPageClient';
import { BoardHeader } from '@/components/boards/BoardHeader';

interface Props {
  params: Promise<{ clientSlug: string; boardId: string }>;
  searchParams: Promise<{ task?: string; comment?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { boardId } = await params;
  const { task: taskId } = await searchParams;

  const board = await db
    .select({ name: boards.name, clientName: clients.name })
    .from(boards)
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(eq(boards.id, boardId))
    .then((rows) => rows[0]);

  if (!board) {
    return {};
  }

  // Use board/client name for all links — avoid exposing task titles to unauthenticated bots
  const title = `${board.name} — ${board.clientName} | Central`;
  const description = taskId ? `Task on ${board.name}` : `Board on Central`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function BoardPage({ params }: Props) {
  const { clientSlug, boardId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    // Bots bypass middleware auth for OG meta tags (link previews).
    // Return empty page so generateMetadata output is served in <head>.
    const headersList = await headers();
    const ua = headersList.get('user-agent') || '';
    if (/bot|crawler|spider|slackbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discord/i.test(ua)) {
      return null;
    }
    redirect('/login');
  }

  const result = await getBoard(boardId);

  if (!result.success || !result.data) {
    notFound();
  }

  const board = result.data;

  // Check if user can edit (admin or full access) for settings link
  const isAdmin = user.role === 'admin';
  const canEdit = isAdmin || (await canUserEditBoard(user.id, boardId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <BoardHeader
        boardId={boardId}
        boardName={board.name}
        clientName={board.client?.name}
        clientSlug={clientSlug}
        canEdit={canEdit}
      />

      {/* Board Content */}
      <BoardPageClient
        boardId={boardId}
        boardName={board.name}
        clientSlug={clientSlug}
        statusOptions={board.statusOptions}
        sectionOptions={board.sectionOptions}
      />
    </div>
  );
}
