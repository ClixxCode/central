import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Settings, Layers } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getRollupBoard } from '@/lib/actions/rollups';
import { RollupPageClient } from '@/components/rollups/RollupPageClient';
import { RollupReviewButton } from '@/components/rollups/RollupReviewButton';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { Button } from '@/components/ui/button';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/rollups"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Layers className="size-4" />
            Rollups
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <h1 className="font-semibold text-foreground">{rollupBoard.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <FavoriteButton entityType="rollup" entityId={rollupId} />
          <RollupReviewButton rollupId={rollupId} reviewModeEnabled={rollupBoard.reviewModeEnabled} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rollups/${rollupId}/settings`}>
              <Settings className="mr-2 size-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Rollup Content */}
      <RollupPageClient rollupBoard={rollupBoard} />
    </div>
  );
}
