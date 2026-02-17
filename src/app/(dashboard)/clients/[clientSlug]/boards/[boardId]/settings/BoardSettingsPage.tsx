'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusOptionsEditor } from '@/components/boards/BoardSettings/StatusOptionsEditor';
import { SectionOptionsEditor } from '@/components/boards/BoardSettings/SectionOptionsEditor';
import { AccessManagement } from '@/components/boards/BoardSettings/AccessManagement';
import { ActivityLog } from '@/components/boards/BoardSettings/ActivityLog';
import { ArchivedTasksTab } from '@/components/boards/BoardSettings/ArchivedTasksTab';
import { SaveBoardAsTemplateDialog } from '@/components/templates/SaveBoardAsTemplateDialog';
import { DeleteBoardDialog } from '@/components/boards/DeleteBoardDialog';
import { useBoard, useUpdateBoard, useDeleteBoard, useTasks } from '@/lib/hooks';
import type { BoardWithAccess } from '@/lib/actions/boards';

interface BoardSettingsPageProps {
  boardId: string;
  clientSlug: string;
  initialData: BoardWithAccess;
  isAdmin: boolean;
}

export function BoardSettingsPage({
  boardId,
  clientSlug,
  initialData,
  isAdmin,
}: BoardSettingsPageProps) {
  const router = useRouter();
  const { data: board } = useBoard(boardId);
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();
  const { data: tasks } = useTasks(boardId);

  const displayBoard = board ?? initialData;

  const [name, setName] = useState(displayBoard.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSaveName = async () => {
    setNameError(null);

    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    try {
      await updateBoard.mutateAsync({
        boardId,
        input: { name: name.trim() },
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleSaveStatusOptions = async (statusOptions: typeof displayBoard.statusOptions) => {
    await updateBoard.mutateAsync({
      boardId,
      input: { statusOptions },
    });
  };

  const handleSaveSectionOptions = async (sectionOptions: typeof displayBoard.sectionOptions) => {
    await updateBoard.mutateAsync({
      boardId,
      input: { sectionOptions },
    });
  };

  const handleDeleteBoard = async () => {
    await deleteBoard.mutateAsync(boardId);
    router.push(`/clients/${clientSlug}`);
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/clients/${clientSlug}/boards/${boardId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to {displayBoard.name}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Board Settings</h1>
        <Link
          href={`/clients/${clientSlug}`}
          className="text-sm text-muted-foreground hover:text-foreground mt-1 inline-block"
        >
          {displayBoard.client?.name ?? 'Client'}
        </Link>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isAdmin ? 'general' : 'activity'}>
        <TabsList>
          {isAdmin && <TabsTrigger value="general">General</TabsTrigger>}
          {isAdmin && <TabsTrigger value="access">Access</TabsTrigger>}
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          {isAdmin && <TabsTrigger value="archived">Archived Tasks</TabsTrigger>}
        </TabsList>

        {/* General Tab (Admin only) */}
        {isAdmin && <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Board Name</CardTitle>
              <CardDescription>
                Change the name of this board.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 max-w-md">
                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Board name"
                  />
                  {nameError && (
                    <p className="text-sm text-destructive mt-1">{nameError}</p>
                  )}
                </div>
                <Button
                  onClick={handleSaveName}
                  disabled={updateBoard.isPending || name === displayBoard.name}
                >
                  {updateBoard.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Options</CardTitle>
              <CardDescription>
                Configure the workflow statuses for tasks on this board. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusOptionsEditor
                options={displayBoard.statusOptions}
                onChange={handleSaveStatusOptions}
                disabled={updateBoard.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section Options</CardTitle>
              <CardDescription>
                Add sections to organize tasks into groups (e.g., by project or category).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectionOptionsEditor
                options={displayBoard.sectionOptions}
                onChange={handleSaveSectionOptions}
                disabled={updateBoard.isPending}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save as Template</CardTitle>
              <CardDescription>
                Create a reusable template from this board&apos;s configuration and tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setSaveAsTemplateOpen(true)}>
                <LayoutTemplate className="mr-2 size-4" />
                Save as Template
              </Button>
            </CardContent>
          </Card>

          <SaveBoardAsTemplateDialog
            open={saveAsTemplateOpen}
            onOpenChange={setSaveAsTemplateOpen}
            boardId={boardId}
            boardName={displayBoard.name}
            taskCount={tasks?.length}
          />

          <Card className="border-destructive bg-destructive/10">
            <CardHeader>
              <CardTitle>Delete Board</CardTitle>
              <CardDescription>
                Permanently delete this board and all of its tasks, comments, and attachments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Board
              </Button>
            </CardContent>
          </Card>

          <DeleteBoardDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            board={displayBoard}
            onConfirm={handleDeleteBoard}
            isPending={deleteBoard.isPending}
          />
        </TabsContent>}

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent task changes on this board from the last 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityLog boardId={boardId} clientSlug={clientSlug} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="access" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Board Access</CardTitle>
                <CardDescription>
                  Manage who can access this board and their permission levels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccessManagement boardId={boardId} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Archived Tasks Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="archived" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Archived Tasks</CardTitle>
                <CardDescription>
                  Browse and restore archived tasks on this board.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ArchivedTasksTab
                  boardId={boardId}
                  clientSlug={clientSlug}
                  statusOptions={displayBoard.statusOptions}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
