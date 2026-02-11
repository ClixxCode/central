'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClients, useCreateBoardFromTemplate } from '@/lib/hooks';

interface CreateBoardFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

export function CreateBoardFromTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
}: CreateBoardFromTemplateDialogProps) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState('');
  const [boardName, setBoardName] = React.useState(templateName);
  const { data: clients = [] } = useClients();
  const createBoard = useCreateBoardFromTemplate();

  React.useEffect(() => {
    if (open) {
      setBoardName(templateName);
      setClientId('');
    }
  }, [open, templateName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !boardName.trim()) return;

    createBoard.mutate(
      { templateId, clientId, boardName: boardName.trim() },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          router.push(`/clients/${data.clientSlug}/boards/${data.boardId}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Board from Template</DialogTitle>
            <DialogDescription>
              Create a new board with this template&apos;s configuration and tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!clientId || !boardName.trim() || createBoard.isPending}
            >
              {createBoard.isPending ? 'Creating...' : 'Create Board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
