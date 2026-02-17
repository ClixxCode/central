'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Users,
  Shield,
  ShieldCheck,
  Mail,
  MoreHorizontal,
  RefreshCw,
  XCircle,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  listAllUsers,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  deleteUser,
  type ManagedUser,
} from '@/lib/actions/user-management';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from '@/lib/actions/invitations';
import { sendPasswordResetLink } from '@/lib/actions/password-reset';
import { startImpersonation } from '@/lib/actions/impersonation';
import { listTeamsWithMembers } from '@/lib/actions/teams';
import { trackEvent } from '@/lib/analytics';

export function UsersPageClient() {
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [inviteTeamId, setInviteTeamId] = useState<string | undefined>(undefined);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  // Queries
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const result = await listAllUsers();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: listInvitations,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams', 'withMembers'],
    queryFn: async () => {
      const result = await listTeamsWithMembers();
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch teams');
      return result.data ?? [];
    },
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: 'admin' | 'user'; teamId?: string }) => {
      const result = await createInvitation(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setInviteEmail('');
      setInviteRole('user');
      setInviteTeamId(undefined);
      setInviteDialogOpen(false);
      toast.success('Invitation sent successfully');
      trackEvent('user_invited');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'user' }) => {
      const result = await updateUserRole(userId, role);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await deactivateUser(userId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await reactivateUser(userId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User reactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await resendInvitation(invitationId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation resent');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await revokeInvitation(invitationId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendResetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await sendPasswordResetLink(userId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Password reset email sent');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await deleteUser(userId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User permanently deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await inviteMutation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole, teamId: inviteTeamId });
  };

  const handleDeactivateUser = (user: ManagedUser) => {
    setDeactivateTarget(user);
    setDeactivateDialogOpen(true);
  };

  const confirmDeactivateUser = async () => {
    if (!deactivateTarget) return;
    await deactivateUserMutation.mutateAsync(deactivateTarget.id);
    setDeactivateDialogOpen(false);
    setDeactivateTarget(null);
  };

  const handleReactivateUser = async (user: ManagedUser) => {
    await reactivateUserMutation.mutateAsync(user.id);
  };

  const handleDeleteUser = (user: ManagedUser) => {
    setDeleteTarget(user);
    setDeleteStep1Open(true);
  };

  const confirmDeleteStep1 = () => {
    setDeleteStep1Open(false);
    setDeleteStep2Open(true);
  };

  const confirmDeleteStep2 = async () => {
    if (!deleteTarget) return;
    await deleteUserMutation.mutateAsync(deleteTarget.id);
    setDeleteStep2Open(false);
    setDeleteTarget(null);
  };

  const handleSendReset = (user: ManagedUser) => {
    setResetTarget(user);
    setResetDialogOpen(true);
  };

  const confirmSendReset = async () => {
    if (!resetTarget) return;
    await sendResetMutation.mutateAsync(resetTarget.id);
    setResetDialogOpen(false);
    setResetTarget(null);
  };

  const handleLoginAs = async (user: ManagedUser) => {
    const result = await startImpersonation(user.id);
    if (result.success) {
      window.location.href = '/my-tasks';
    } else {
      toast.error(result.error ?? 'Failed to impersonate user');
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
    return email.slice(0, 2).toUpperCase();
  };

  const pendingInvitations = invitations?.filter((i) => i.status === 'pending') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage users and invitations for your organization
          </p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation to join Central. They'll receive an email with a link to create
                their account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'user' | 'admin')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Admins can manage users, clients, teams, and settings.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team (optional)</Label>
                <Select
                  value={inviteTeamId ?? 'none'}
                  onValueChange={(v) => setInviteTeamId(v === 'none' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teamsData?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign the user to a team when they accept the invitation.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
              >
                {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users ({users?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            Pending Invitations ({pendingInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          {usersLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : users?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users yet. Invite your first team member to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => {
                    const isDeactivated = !!user.deactivatedAt;
                    return (
                    <TableRow key={user.id} className={isDeactivated ? 'opacity-60' : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-xs">
                              {getInitials(user.name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name ?? 'No name'}</p>
                              {isDeactivated && (
                                <Badge variant="outline" className="text-xs">Deactivated</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          disabled={isDeactivated}
                          onValueChange={(value) =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: value as 'admin' | 'user',
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3" />
                                User
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" />
                                Admin
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.teamCount} teams</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isDeactivated && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleLoginAs(user)}
                                >
                                  <LogIn className="h-4 w-4 mr-2" />
                                  Login As
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSendReset(user)}
                                >
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Send Password Reset
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {isDeactivated ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleReactivateUser(user)}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete permanently
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeactivateUser(user)}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          {invitationsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : pendingInvitations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending invitations.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invitation.teamName ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => resendMutation.mutate(invitation.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Resend
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => revokeMutation.mutate(invitation.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Revoke
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {deactivateTarget?.name || deactivateTarget?.email}? They will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={confirmDeactivateUser}
              variant="destructive"
            >
              Deactivate
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send password reset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a password reset email to {resetTarget?.name || resetTarget?.email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={confirmSendReset}
            >
              Send reset
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user — Step 1: Initial confirmation */}
      <AlertDialog open={deleteStep1Open} onOpenChange={setDeleteStep1Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {deleteTarget?.name || deleteTarget?.email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={confirmDeleteStep1}
              variant="destructive"
            >
              I&apos;m sure
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user — Step 2: Final confirmation with consequences */}
      <AlertDialog open={deleteStep2Open} onOpenChange={setDeleteStep2Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete user</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will permanently delete {deleteTarget?.name || deleteTarget?.email}. The following will happen:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Their name will be removed from all tasks, boards, and comments they created</li>
                  <li>Their task assignments and team memberships will be removed</li>
                  <li>Their comments will be preserved but shown as &quot;Deleted user&quot;</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={confirmDeleteStep2}
              disabled={deleteUserMutation.isPending}
              variant="destructive"
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete permanently'}
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
