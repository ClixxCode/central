import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Layers } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getRollupBoard } from '@/lib/actions/rollups';
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
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/rollups"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Layers className="size-4" />
          Rollups
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link
          href={`/rollups/${rollupId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {rollupBoard.name}
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-semibold text-foreground">Settings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Rollup Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update rollup name and source boards
        </p>
      </div>

      {/* Settings Form */}
      <RollupSettingsForm rollupBoard={rollupBoard} />
    </div>
  );
}
