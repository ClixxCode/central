'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusSelect } from './StatusSelect';
import { SectionSelect } from './SectionSelect';
import { useCreateProject } from '@/lib/hooks/useTasks';
import { isCompleteStatus } from '@/lib/utils/status';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  clientSlug: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  boardId,
  clientSlug,
  statusOptions,
  sectionOptions,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const createProject = useCreateProject(boardId);
  const defaultStatus =
    statusOptions.find((status) => !isCompleteStatus(status.id, statusOptions))?.id ??
    statusOptions[0]?.id ??
    'todo';
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState(defaultStatus);
  const [section, setSection] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
    }
  }, [defaultStatus, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    createProject.mutate(
      {
        name: trimmedName,
        description: description.trim() || null,
        status,
        section,
        dueDate: dueDate || null,
      },
      {
        onSuccess: (project) => {
          setName('');
          setDescription('');
          setSection(null);
          setDueDate('');
          onOpenChange(false);
          router.push(`/clients/${clientSlug}/boards/${project.projectBoardId}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-5" />
            New Project
          </DialogTitle>
          <DialogDescription>
            Create a project card on this board and open its task board.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <StatusSelect value={status} onChange={setStatus} options={statusOptions} />
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <SectionSelect value={section} onChange={setSection} options={sectionOptions} placeholder="No section" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-due-date">Due date</Label>
            <Input
              id="project-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending || !name.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
