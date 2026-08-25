'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser, useTeamsWithMembers, useUsersForTeams } from '@/lib/hooks';
import { useDeleteSavedView, useSavedViewSharing, useSavedViewSharingMutations } from '@/lib/hooks/useSavedViews';
import type { SavedViewWithSources } from '@/lib/actions/saved-views';

export function SavedViewSettings({ view }: { view: SavedViewWithSources }) {
  const router = useRouter();
  const deleteView = useDeleteSavedView();
  const { user } = useCurrentUser();
  const { data: users = [] } = useUsersForTeams();
  const { data: teams = [] } = useTeamsWithMembers();
  const { data: invitations = [], isLoading } = useSavedViewSharing(view.id);
  const mutations = useSavedViewSharingMutations(view.id);
  const [userId, setUserId] = React.useState('');
  const [teamId, setTeamId] = React.useState('');
  const invitedUserIds = new Set(invitations.flatMap((invite) => invite.userId ? [invite.userId] : []));
  const invitedTeamIds = new Set(invitations.flatMap((invite) => invite.teamId ? [invite.teamId] : []));
  const hasAllUsers = invitations.some((invite) => invite.allUsers);

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Sharing</CardTitle>
        <CardDescription>Views are private by default. Sharing does not grant access to source boards.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <Select value={userId} onValueChange={setUserId}><SelectTrigger><SelectValue placeholder="Select a user…" /></SelectTrigger>
              <SelectContent>{users.filter((candidate) => !invitedUserIds.has(candidate.id)).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name ?? candidate.email}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" disabled={!userId || mutations.inviteUser.isPending} onClick={() => mutations.inviteUser.mutate(userId, { onSuccess: () => setUserId('') })}><UserPlus className="size-4" /></Button>
          </div>
          <div className="flex gap-2">
            <Select value={teamId} onValueChange={setTeamId}><SelectTrigger><SelectValue placeholder="Select a team…" /></SelectTrigger>
              <SelectContent>{teams.filter((team) => !invitedTeamIds.has(team.id)).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" disabled={!teamId || mutations.inviteTeam.isPending} onClick={() => mutations.inviteTeam.mutate(teamId, { onSuccess: () => setTeamId('') })}><Users className="size-4" /></Button>
          </div>
        </div>
        {user?.role === 'admin' && !hasAllUsers && <Button variant="outline" onClick={() => mutations.inviteAll.mutate()} disabled={mutations.inviteAll.isPending}><Globe className="mr-2 size-4" />Share with all users</Button>}
        <div className="space-y-2">
          {isLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : invitations.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No invitations. This view is private.</p>
          ) : invitations.map((invite) => <div key={invite.id} className="flex items-center gap-3 rounded-md border p-3">
            {invite.allUsers ? <Globe className="size-4" /> : invite.teamId ? <Users className="size-4" /> : <UserPlus className="size-4" />}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invite.allUsers ? 'All users' : invite.teamName ?? invite.userName ?? invite.userEmail}</p>
              <p className="text-xs text-muted-foreground">{invite.allUsers ? 'Excludes contractors' : invite.teamId ? 'Team' : 'User'}</p></div>
            <Badge variant={invite.status === 'accepted' ? 'default' : invite.status === 'declined' ? 'destructive' : 'secondary'}>{invite.status}</Badge>
            <Button variant="ghost" size="icon" onClick={() => mutations.remove.mutate(invite.id)} disabled={mutations.remove.isPending}><X className="size-4" /></Button>
          </div>)}
        </div>
      </CardContent>
    </Card>

    <Card className="border-destructive/50"><CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle>
      <CardDescription>Delete this saved view. Source boards and tasks are not affected.</CardDescription></CardHeader>
      <CardContent><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 size-4" />Delete View</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{view.name}”?</AlertDialogTitle>
          <AlertDialogDescription>This permanently removes the view and everyone’s favorites for it. Tasks are not deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteView.mutate(view.id, { onSuccess: () => router.push('/views') })}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent></AlertDialog></CardContent>
    </Card>
  </div>;
}
