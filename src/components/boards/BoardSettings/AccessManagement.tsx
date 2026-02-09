'use client';

import { useState } from 'react';
import { Plus, Trash2, Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddAccessModal } from './AddAccessModal';
import { useBoard, useUpdateBoardAccess, useRemoveBoardAccess } from '@/lib/hooks';

interface AccessManagementProps {
  boardId: string;
}

export function AccessManagement({ boardId }: AccessManagementProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { data: board, isLoading } = useBoard(boardId);
  const updateAccess = useUpdateBoardAccess(boardId);
  const removeAccess = useRemoveBoardAccess(boardId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!board) {
    return <p className="text-muted-foreground">Board not found</p>;
  }

  const userAccess = board.access.filter((a) => a.userId);
  const teamAccess = board.access.filter((a) => a.teamId);
  const hasAccess = userAccess.length > 0 || teamAccess.length > 0;

  const handleAccessLevelChange = (accessId: string, accessLevel: 'full' | 'assigned_only') => {
    updateAccess.mutate({ accessId, accessLevel });
  };

  const handleRemoveAccess = (accessId: string) => {
    removeAccess.mutate(accessId);
  };

  const existingUserIds = userAccess.map((a) => a.userId!);
  const existingTeamIds = teamAccess.map((a) => a.teamId!);

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Users}
          title="No access configured"
          description="Add users or teams to grant them access to this board."
          action={
            <Button onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Access
            </Button>
          }
        />
        <AddAccessModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          boardId={boardId}
          existingUserIds={existingUserIds}
          existingTeamIds={existingTeamIds}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Access
        </Button>
      </div>

      {/* User Access */}
      {userAccess.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            Users ({userAccess.length})
          </h4>
          {userAccess.map((access) => (
            <div
              key={access.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={access.user?.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {access.user?.name?.[0] ?? access.user?.email?.[0] ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {access.user?.name ?? 'Unknown User'}
                </p>
                <p className="text-sm text-muted-foreground truncate">{access.user?.email}</p>
              </div>
              <Select
                value={access.accessLevel}
                onValueChange={(value) =>
                  handleAccessLevelChange(access.id, value as 'full' | 'assigned_only')
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access</SelectItem>
                  <SelectItem value="assigned_only">Assigned Only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive/80"
                onClick={() => handleRemoveAccess(access.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Team Access */}
      {teamAccess.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Teams ({teamAccess.length})
          </h4>
          {teamAccess.map((access) => (
            <div
              key={access.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {access.team?.name ?? 'Unknown Team'}
                </p>
                <p className="text-sm text-muted-foreground">Team</p>
              </div>
              <Select
                value={access.accessLevel}
                onValueChange={(value) =>
                  handleAccessLevelChange(access.id, value as 'full' | 'assigned_only')
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access</SelectItem>
                  <SelectItem value="assigned_only">Assigned Only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive/80"
                onClick={() => handleRemoveAccess(access.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AddAccessModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        boardId={boardId}
        existingUserIds={existingUserIds}
        existingTeamIds={existingTeamIds}
      />
    </div>
  );
}
