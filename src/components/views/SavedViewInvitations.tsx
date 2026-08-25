'use client';

import { Check, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { usePendingSavedViewInvitations, useRespondToSavedViewInvitation } from '@/lib/hooks/useSavedViews';

export function SavedViewInvitations() {
  const router = useRouter();
  const { data: invitations = [] } = usePendingSavedViewInvitations();
  const respond = useRespondToSavedViewInvitation();
  if (invitations.length === 0) return null;
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">Invitations</h2>
    <div className="space-y-2">
      {invitations.map((invitation) => <div key={invitation.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <Users className="size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invitation.viewName}</p>
          <p className="text-xs text-muted-foreground">Shared with {invitation.target === 'team' ? 'your team' : 'you'}</p></div>
        <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ invitationId: invitation.id, accept: false }, { onSuccess: () => router.refresh() })}><X className="mr-1 size-4" />Decline</Button>
        <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ invitationId: invitation.id, accept: true }, { onSuccess: () => router.refresh() })}><Check className="mr-1 size-4" />Accept</Button>
      </div>)}
    </div>
  </section>;
}
