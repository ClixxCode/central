'use client';

import { useState } from 'react';
import { Users, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUsers, useTeams, useAddBoardAccess } from '@/lib/hooks';

interface AddAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  existingUserIds: string[];
  existingTeamIds: string[];
}

export function AddAccessModal({
  open,
  onOpenChange,
  boardId,
  existingUserIds,
  existingTeamIds,
}: AddAccessModalProps) {
  const [tab, setTab] = useState<'user' | 'team'>('user');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<'full' | 'assigned_only'>('full');

  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const addAccess = useAddBoardAccess();

  // Filter out already added users/teams
  const availableUsers = users.filter((u) => !existingUserIds.includes(u.id));
  const availableTeams = teams.filter((t) => !existingTeamIds.includes(t.id));

  const handleAdd = async () => {
    const input =
      tab === 'user'
        ? { boardId, userId: selectedUserId, accessLevel }
        : { boardId, teamId: selectedTeamId, accessLevel };

    try {
      await addAccess.mutateAsync(input);
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setSelectedTeamId('');
    setAccessLevel('full');
    setTab('user');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const canSubmit =
    (tab === 'user' && selectedUserId) || (tab === 'team' && selectedTeamId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Access</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'user' | 'team')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">
              <User className="h-4 w-4 mr-2" />
              User
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="mt-4 space-y-4">
            {usersLoading ? (
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All users already have access to this board.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Select User
                </label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {user.name?.[0] ?? user.email[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.name ?? user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-4 space-y-4">
            {teamsLoading ? (
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : availableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {teams.length === 0
                  ? 'No teams have been created yet.'
                  : 'All teams already have access to this board.'}
              </p>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Select Team
                </label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{team.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Access Level */}
        <div className="space-y-2 pt-2">
          <label className="text-sm font-medium text-foreground">Access Level</label>
          <Select
            value={accessLevel}
            onValueChange={(v) => setAccessLevel(v as 'full' | 'assigned_only')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">
                <div>
                  <p className="font-medium">Full Access</p>
                  <p className="text-xs text-muted-foreground">
                    Can see all tasks and edit board settings
                  </p>
                </div>
              </SelectItem>
              <SelectItem value="assigned_only">
                <div>
                  <p className="font-medium">Assigned Only</p>
                  <p className="text-xs text-muted-foreground">
                    Can only see tasks assigned to them
                  </p>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canSubmit || addAccess.isPending}>
            {addAccess.isPending ? 'Adding...' : 'Add Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
