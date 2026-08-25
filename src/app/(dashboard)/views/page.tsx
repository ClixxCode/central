import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye, Layers, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { listSavedViews } from '@/lib/actions/saved-views';
import { listRollupBoards } from '@/lib/actions/rollups';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { SavedViewInvitations } from '@/components/views';

export default async function ViewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [viewsResult, rollupsResult] = await Promise.all([listSavedViews(), listRollupBoards()]);
  const views = viewsResult.data ?? [];
  const rollups = rollupsResult.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Views</h1>
          <p className="text-sm text-muted-foreground">Save focused task views across boards, people, and statuses.</p>
        </div>
        <Button asChild><Link href="/views/new"><Plus className="mr-2 size-4" />New View</Link></Button>
      </div>

      <SavedViewInvitations />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saved Views</h2>
        {views.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center py-12 text-center">
            <Eye className="size-11 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No saved views yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Choose boards and filters, preview the results, and save the setup for later.</p>
            <Button asChild className="mt-5"><Link href="/views/new">Create your first view</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {views.map((view) => (
              <Card key={view.id} className="transition-colors hover:border-primary/50">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <Link href={`/views/${view.id}`} className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2"><Eye className="size-5" /><span className="truncate">{view.name}</span></CardTitle>
                    <CardDescription className="mt-2">{view.sourceCount} {view.sourceCount === 1 ? 'board' : 'boards'} · {view.isOwner ? 'Owner' : 'Shared'}</CardDescription>
                  </Link>
                  <FavoriteButton entityType="view" entityId={view.id} />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      {rollups.length > 0 && (
        <section id="legacy-rollups" className="space-y-3 scroll-mt-6">
          <div>
            <h2 className="text-lg font-semibold">Legacy Rollups</h2>
            <p className="text-sm text-muted-foreground">Existing automated Rollups remain available, but new aggregation should use Views.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rollups.map((rollup) => (
              <Link key={rollup.id} href={`/rollups/${rollup.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50"><CardHeader>
                  <CardTitle className="flex items-center gap-2"><Layers className="size-5" />{rollup.name}</CardTitle>
                  <CardDescription>{rollup.sourceCount} {rollup.sourceCount === 1 ? 'board' : 'boards'}</CardDescription>
                </CardHeader></Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
