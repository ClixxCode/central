'use client';

import { useState } from 'react';
import { Users, UserPlus, Globe, X, Check, Crown, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useRollupOwners,
  useRollupInvitations,
  useInviteUserToRollup,
  useInviteTeamToRollup,
  useInviteAllUsersToRollup,
  useRemoveRollupInvitation,
  useTransferRollupOwnership,
  useTeamsWithMembers,
  useUsersForTeams,
  useCurrentUser,
} from '@/lib/hooks';
import { cn } from '@/lib/utils';

interface RollupSharingDialogProps {
  rollupBoardId: string;
  rollupName: string;
  children?: React.ReactNode;
}

export function RollupSharingDialog({
  rollupBoardId,
  rollupName,
  children,
}: RollupSharingDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [showShareAllConfirm, setShowShareAllConfirm] = useState(false);

  const { user: currentUser } = useCurrentUser();
  const { data: owners, isLoading: ownersLoading } = useRollupOwners(rollupBoardId);
  const { data: invitations, isLoading: invitationsLoading } = useRollupInvitations(rollupBoardId);
  const { data: teams } = useTeamsWithMembers();
  const { data: users } = useUsersForTeams();

  const inviteUser = useInviteUserToRollup();
  const inviteTeam = useInviteTeamToRollup();
  const inviteAllUsers = useInviteAllUsersToRollup();
  const removeInvitation = useRemoveRollupInvitation();
  const transferOwnership = useTransferRollupOwnership();

  const isAdmin = currentUser?.role === 'admin';
  const isOwner = owners?.some((o) => o.userId === currentUser?.id);
  const canManage = isAdmin || isOwner;

  // Filter out already invited users
  const invitedUserIds = new Set(invitations?.filter((i) => i.userId).map((i) => i.userId) ?? []);
  const availableUsers = users?.filter((u) => !invitedUserIds.has(u.id)) ?? [];

  // Filter out already invited teams
  const invitedTeamIds = new Set(invitations?.filter((i) => i.teamId).map((i) => i.teamId) ?? []);
  const availableTeams = teams?.filter((t) => !invitedTeamIds.has(t.id)) ?? [];

  const hasAllUsersInvite = invitations?.some((i) => i.allUsers);

  const handleInviteUser = () => {
    if (selectedUserId) {
      inviteUser.mutate(
        { rollupBoardId, userId: selectedUserId },
        { onSuccess: () => setSelectedUserId('') }
      );
    }
  };

  const handleInviteTeam = () => {
    if (selectedTeamId) {
      inviteTeam.mutate(
        { rollupBoardId, teamId: selectedTeamId },
        { onSuccess: () => setSelectedTeamId('') }
      );
    }
  };

  const handleInviteAllUsers = () => {
    setShowShareAllConfirm(true);
  };

  const confirmInviteAllUsers = () => {
    inviteAllUsers.mutate(rollupBoardId, {
      onSettled: () => setShowShareAllConfirm(false),
    });
  };

  const handleRemoveInvitation = (invitationId: string) => {
    removeInvitation.mutate({ invitationId, rollupBoardId });
  };

  const handleTransferOwnership = () => {
    if (transferUserId && confirm('Are you sure you want to transfer ownership? You will lose owner privileges.')) {
      transferOwnership.mutate(
        { rollupBoardId, newOwnerUserId: transferUserId },
        { onSuccess: () => setTransferUserId('') }
      );
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{rollupName}"</DialogTitle>
          <DialogDescription>
            Invite users or teams to access this rollup
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="invitations" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
          </TabsList>

          <TabsContent value="invitations" className="space-y-4">
            {canManage && (
              <div className="space-y-3">
                {/* Invite User */}
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name ?? user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleInviteUser}
                    disabled={!selectedUserId || inviteUser.isPending}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Invite Team */}
                <div className="flex gap-2">
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams?.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleInviteTeam}
                    disabled={!selectedTeamId || inviteTeam.isPending}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>

                {/* Invite All Users (Admin only) */}
                {isAdmin && !hasAllUsersInvite && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleInviteAllUsers}
                    disabled={inviteAllUsers.isPending}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Share with All Users
                  </Button>
                )}
              </div>
            )}

            <Separator />

            {/* Current Invitations */}
            <ScrollArea className="h-[250px]">
              {invitationsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : invitations && invitations.length > 0 ? (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center gap-3 p-2 rounded-lg border"
                    >
                      {invitation.allUsers ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">All Users</p>
                            <p className="text-xs text-muted-foreground">
                              Excludes contractor teams
                            </p>
                          </div>
                        </>
                      ) : invitation.teamId ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{invitation.teamName}</p>
                            <p className="text-xs text-muted-foreground">Team</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(invitation.userName, invitation.userEmail ?? '')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {invitation.userName ?? invitation.userEmail}
                            </p>
                            {invitation.userName && (
                              <p className="text-xs text-muted-foreground">
                                {invitation.userEmail}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                      <Badge
                        variant={
                          invitation.status === 'accepted'
                            ? 'default'
                            : invitation.status === 'declined'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {invitation.status}
                      </Badge>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveInvitation(invitation.id)}
                          disabled={removeInvitation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No invitations yet. This rollup is private.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ownership" className="space-y-4">
            {/* Current Owners */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Owners</h4>
              {ownersLoading ? (
                <div className="space-y-2">
                  <div className="h-12 bg-muted animate-pulse rounded" />
                </div>
              ) : owners && owners.length > 0 ? (
                <div className="space-y-2">
                  {owners.map((owner) => (
                    <div
                      key={owner.id}
                      className="flex items-center gap-3 p-2 rounded-lg border"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={owner.userAvatarUrl ?? undefined} />
                        <AvatarFallback>
                          {getInitials(owner.userName, owner.userEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {owner.userName ?? owner.userEmail}
                        </p>
                        {owner.userName && (
                          <p className="text-xs text-muted-foreground">{owner.userEmail}</p>
                        )}
                      </div>
                      {owner.isPrimary && (
                        <Badge variant="outline">
                          <Crown className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No owners found</p>
              )}
            </div>

            {/* Transfer Ownership */}
            {isOwner && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Transfer Ownership</h4>
                  <p className="text-xs text-muted-foreground">
                    Transfer primary ownership to another user
                  </p>
                  <div className="flex gap-2">
                    <Select value={transferUserId} onValueChange={setTransferUserId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select new owner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          ?.filter((u) => u.id !== currentUser?.id)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name ?? user.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleTransferOwnership}
                      disabled={!transferUserId || transferOwnership.isPending}
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={showShareAllConfirm} onOpenChange={setShowShareAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share with All Users</AlertDialogTitle>
            <AlertDialogDescription>
              This will share <strong>{rollupName}</strong> with all current and future users (excluding contractors). This can be undone by removing the invitation later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={confirmInviteAllUsers}
              disabled={inviteAllUsers.isPending}
            >
              {inviteAllUsers.isPending ? 'Sharing...' : 'Share with All'}
            </AlertDialogAction>
            <AlertDialogCancel disabled={inviteAllUsers.isPending}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
