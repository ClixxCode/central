import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Eye } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getSavedView } from '@/lib/actions/saved-views';
import { SavedViewSettings } from '@/components/views/SavedViewSettings';

export default async function SavedViewSettingsPage({ params }: { params: Promise<{ viewId: string }> }) {
  const { viewId } = await params;
  if (!(await getCurrentUser())) redirect('/login');
  const result = await getSavedView(viewId);
  if (!result.success || !result.data || !result.data.canEdit) notFound();
  return <div className="space-y-6">
    <div className="flex items-center gap-2 text-sm">
      <Link href="/views" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Eye className="size-4" />Views</Link>
      <ChevronRight className="size-4 text-muted-foreground" />
      <Link href={`/views/${viewId}`} className="text-muted-foreground hover:text-foreground">{result.data.name}</Link>
      <ChevronRight className="size-4 text-muted-foreground" /><h1 className="font-semibold">Settings</h1>
    </div>
    <SavedViewSettings view={result.data} />
  </div>;
}
