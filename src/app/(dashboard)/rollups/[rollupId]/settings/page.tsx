import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getRollupBoard } from '@/lib/actions/rollups';
import { RollupSettingsHeader } from '@/components/rollups/RollupSettingsHeader';
import { RollupSettingsForm } from './RollupSettingsForm';

interface Props {
  params: Promise<{ rollupId: string }>;
}

export default async function RollupSettingsPage({ params }: Props) {
  const { rollupId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const result = await getRollupBoard(rollupId);

  if (!result.success || !result.data) {
    notFound();
  }

  const rollupBoard = result.data;

  // Check if user can edit (creator or admin)
  const canEdit = user.role === 'admin' || rollupBoard.createdBy === user.id;

  if (!canEdit) {
    redirect(`/rollups/${rollupId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RollupSettingsHeader rollupId={rollupId} rollupName={rollupBoard.name} />
      <RollupSettingsForm rollupBoard={rollupBoard} />
    </div>
  );
}
