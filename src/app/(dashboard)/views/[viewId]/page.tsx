import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Eye, Settings } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getSavedView } from '@/lib/actions/saved-views';
import { SavedViewWorkspace } from '@/components/views';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { Button } from '@/components/ui/button';

export default async function SavedViewPage({ params }: { params: Promise<{ viewId: string }> }) {
  const { viewId } = await params;
  if (!(await getCurrentUser())) redirect('/login');
  const result = await getSavedView(viewId);
  if (!result.success || !result.data) notFound();
  const view = result.data;
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Link href="/views" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Eye className="size-4" />Views</Link>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" /><h1 className="truncate font-semibold">{view.name}</h1>
      </div>
      <div className="flex items-center gap-2">
        <FavoriteButton entityType="view" entityId={view.id} />
        {view.canEdit && <Button variant="outline" size="sm" asChild><Link href={`/views/${view.id}/settings`}><Settings className="mr-2 size-4" />Settings</Link></Button>}
      </div>
    </div>
    <SavedViewWorkspace view={view} />
  </div>;
}
