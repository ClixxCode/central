'use client';

import { Globe, Lock, Users, User, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useBoard, useTeamsWithMembers } from '@/lib/hooks';
import type { BoardAccessEntry } from '@/lib/actions/boards';
import type { TeamWithMembers } from '@/lib/actions/teams';
import { cn } from '@/lib/utils';

interface BoardVisibilityTabProps {
  boardId: string;
}

export function BoardVisibilityTab({ boardId }: BoardVisibilityTabProps) {
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const { data: teams } = useTeamsWithMembers();

  if (boardLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!board) {
    return <p className="text-muted-foreground">Board not found</p>;
  }

  const userAccess = board.access.filter((a) => a.userId);
  const teamAccess = board.access.filter((a) => a.teamId);
  const hasRestrictions = userAccess.length > 0 || teamAccess.length > 0;

  // Get contractor teams (those with excludeFromPublic)
  const contractorTeams = teams?.filter((t) => t.excludeFromPublic) ?? [];

  // Determine visibility status
  const getVisibilityStatus = () => {
    if (!hasRestrictions) {
      return {
        label: 'Public',
        description: `Visible to all users${contractorTeams.length > 0 ? ' except contractor teams' : ''}`,
        icon: Globe,
        variant: 'default' as const,
      };
    }
    return {
      label: 'Restricted',
      description: 'Only visible to invited users and teams',
      icon: Lock,
      variant: 'secondary' as const,
    };
  };

  const visibility = getVisibilityStatus();
  const VisibilityIcon = visibility.icon;

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

  const getAccessLevelBadge = (level: 'full' | 'assigned_only') => {
    if (level === 'full') {
      return (
        <Badge variant="outline" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          Full Access
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        <User className="h-3 w-3 mr-1" />
        Assigned Only
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Visibility Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                hasRestrictions ? 'bg-secondary' : 'bg-primary/10'
              )}
            >
              <VisibilityIcon
                className={cn('h-5 w-5', hasRestrictions ? 'text-foreground' : 'text-primary')}
              />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {visibility.label}
                <Badge variant={visibility.variant}>{hasRestrictions ? 'Private' : 'Public'}</Badge>
              </CardTitle>
              <CardDescription>{visibility.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Access List */}
      {hasRestrictions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access List</CardTitle>
            <CardDescription>
              Users and teams with access to this board
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Access */}
            {userAccess.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Users ({userAccess.length})
                </h4>
                <div className="space-y-2 pl-6">
                  {userAccess.map((access) => (
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={access.user?.avatarUrl ?? undefined} />
                          <AvatarFallback>
                            {getInitials(access.user?.name ?? null, access.user?.email ?? '')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {access.user?.name ?? access.user?.email}
                          </p>
                          {access.user?.name && (
                            <p className="text-xs text-muted-foreground">{access.user.email}</p>
                          )}
                        </div>
                      </div>
                      {getAccessLevelBadge(access.accessLevel)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userAccess.length > 0 && teamAccess.length > 0 && <Separator />}

            {/* Team Access */}
            {teamAccess.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teams ({teamAccess.length})
                </h4>
                <div className="space-y-2 pl-6">
                  {teamAccess.map((access) => {
                    const team = teams?.find((t) => t.id === access.teamId);
                    return (
                      <div
                        key={access.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                              {access.team?.name ?? 'Unknown Team'}
                              {team?.excludeFromPublic && (
                                <Badge variant="outline" className="text-xs">
                                  Contractor
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {team?.members.length ?? 0} members
                            </p>
                          </div>
                        </div>
                        {getAccessLevelBadge(access.accessLevel)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Public Board Info */}
      {!hasRestrictions && contractorTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Excluded Teams</CardTitle>
            <CardDescription>
              Contractor teams that cannot see public boards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contractorTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.members.length} members
                    </p>
                  </div>
                  <Badge variant="destructive" className="ml-auto">
                    Excluded
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
