'use client';

import { useState } from 'react';
import { Plus, Users, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useTeamsWithMembers,
  useUsersForTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddUserToTeam,
  useRemoveUserFromTeam,
} from '@/lib/hooks';

export function TeamsPageClient() {
  const { data: teams, isLoading } = useTeamsWithMembers();
  const { data: allUsers } = useUsersForTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addUser = useAddUserToTeam();
  const removeUser = useRemoveUserFromTeam();

  const [newTeamName, setNewTeamName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTeamForAddMember, setSelectedTeamForAddMember] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    await createTeam.mutateAsync(newTeamName);
    setNewTeamName('');
    setCreateDialogOpen(false);
  };

  const handleToggleExclude = async (teamId: string, currentValue: boolean) => {
    await updateTeam.mutateAsync({
      teamId,
      data: { excludeFromPublic: !currentValue },
    });
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }
    await deleteTeam.mutateAsync(teamId);
  };

  const handleAddMember = async (teamId: string) => {
    if (!selectedUserId) return;

    await addUser.mutateAsync({ teamId, userId: selectedUserId });
    setSelectedUserId('');
    setSelectedTeamForAddMember(null);
  };

  const handleRemoveMember = async (teamId: string, userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this team?`)) return;
    await removeUser.mutateAsync({ teamId, userId });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage teams for board access control</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Teams can be assigned board access permissions.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g., Marketing, Development"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTeam();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={createTeam.isPending || !newTeamName.trim()}>
                {createTeam.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {teams?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No teams yet. Create your first team to get started.</p>
            </CardContent>
          </Card>
        )}

        {teams?.map((team) => {
          const nonMembers =
            allUsers?.filter((u) => !team.members.some((m) => m.id === u.id)) || [];

          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {team.name}
                      <Badge variant="secondary">{team.members.length} members</Badge>
                    </CardTitle>
                    <CardDescription>
                      Created {new Date(team.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`exclude-${team.id}`} className="text-sm text-muted-foreground">
                        Exclude from public boards
                      </Label>
                      <Switch
                        id={`exclude-${team.id}`}
                        checked={team.excludeFromPublic}
                        onCheckedChange={() => handleToggleExclude(team.id, team.excludeFromPublic)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTeam(team.id)}
                      disabled={deleteTeam.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Members</Label>
                    <Dialog
                      open={selectedTeamForAddMember === team.id}
                      onOpenChange={(open) => {
                        setSelectedTeamForAddMember(open ? team.id : null);
                        if (!open) setSelectedUserId('');
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Member to {team.name}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                          <Label>Select User</Label>
                          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent>
                              {nonMembers.length === 0 ? (
                                <SelectItem value="" disabled>
                                  All users are already members
                                </SelectItem>
                              ) : (
                                nonMembers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name || user.email}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleAddMember(team.id)}
                            disabled={!selectedUserId || addUser.isPending}
                          >
                            {addUser.isPending ? 'Adding...' : 'Add Member'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {team.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 bg-muted rounded-full pl-1 pr-2 py-1"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {member.name?.[0] || member.email[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name || member.email}</span>
                          <button
                            onClick={() =>
                              handleRemoveMember(team.id, member.id, member.name || member.email)
                            }
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            disabled={removeUser.isPending}
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
