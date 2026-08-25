import Link from 'next/link';
import { ChevronRight, Eye } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { SavedViewWorkspace } from '@/components/views';

export default async function NewSavedViewPage() {
  if (!(await getCurrentUser())) redirect('/login');
  return <div className="space-y-6">
    <div className="flex items-center gap-2 text-sm">
      <Link href="/views" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Eye className="size-4" />Views</Link>
      <ChevronRight className="size-4 text-muted-foreground" /><h1 className="font-semibold">New View</h1>
    </div>
    <SavedViewWorkspace />
  </div>;
}
