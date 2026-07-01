import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getRollupBoard } from '@/lib/actions/rollups';
import { RollupPageClient } from '@/components/rollups/RollupPageClient';
import { RollupHeader } from '@/components/rollups/RollupHeader';

interface Props {
  params: Promise<{ rollupId: string }>;
}

export default async function RollupBoardPage({ params }: Props) {
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

  return (
    <>
      <RollupHeader
        rollupId={rollupId}
        rollupName={rollupBoard.name}
        reviewModeEnabled={rollupBoard.reviewModeEnabled}
      />
      <RollupPageClient rollupBoard={rollupBoard} />
    </>
  );
}
