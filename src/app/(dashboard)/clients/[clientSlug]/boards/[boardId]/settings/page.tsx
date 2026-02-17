import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getBoard, canUserEditBoard } from '@/lib/actions/boards';
import { BoardSettingsPage } from './BoardSettingsPage';

interface Props {
  params: Promise<{ clientSlug: string; boardId: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { clientSlug, boardId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const result = await getBoard(boardId);

  if (!result.success || !result.data) {
    notFound();
  }

  // Check if user can edit (admin or full access)
  const isAdmin = user.role === 'admin';
  const canEdit = isAdmin || (await canUserEditBoard(user.id, boardId));

  if (!canEdit) {
    notFound();
  }

  return (
    <BoardSettingsPage
      boardId={boardId}
      clientSlug={clientSlug}
      initialData={result.data}
      isAdmin={isAdmin}
    />
  );
}
