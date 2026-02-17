'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { RollupSourceSelector } from '@/components/rollups/RollupSourceSelector';
import { RollupSharingDialog } from '@/components/rollups/RollupSharingDialog';
import {
  useUpdateRollupBoard,
  useUpdateRollupSources,
  useDeleteRollupBoard,
  useAvailableSourceBoards,
} from '@/lib/hooks/useRollupBoards';
import type { RollupBoardWithSources } from '@/lib/actions/rollups';

interface RollupSettingsFormProps {
  rollupBoard: RollupBoardWithSources;
}

export function RollupSettingsForm({ rollupBoard }: RollupSettingsFormProps) {
  const router = useRouter();
  const updateRollup = useUpdateRollupBoard();
  const updateSources = useUpdateRollupSources();
  const deleteRollup = useDeleteRollupBoard();
  const { data: availableBoards = [], isLoading: isLoadingBoards } =
    useAvailableSourceBoards();

  const [name, setName] = React.useState(rollupBoard.name);
  const [selectedBoardIds, setSelectedBoardIds] = React.useState<string[]>(
    rollupBoard.sources.map((s) => s.boardId)
  );
  const [reviewModeEnabled, setReviewModeEnabled] = React.useState(rollupBoard.reviewModeEnabled);
  const [errors, setErrors] = React.useState<{
    name?: string;
    boards?: string;
  }>({});

  const hasNameChanged = name !== rollupBoard.name;
  const hasBoardsChanged =
    JSON.stringify(selectedBoardIds.sort()) !==
    JSON.stringify(rollupBoard.sources.map((s) => s.boardId).sort());
  const hasReviewModeChanged = reviewModeEnabled !== rollupBoard.reviewModeEnabled;
  const hasChanges = hasNameChanged || hasBoardsChanged || hasReviewModeChanged;

  const isSaving = updateRollup.isPending || updateSources.isPending;

  const handleSave = async () => {
    // Validate
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (selectedBoardIds.length === 0) {
      newErrors.boards = 'Select at least one source board';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Update board settings if changed
    if (hasNameChanged || hasReviewModeChanged) {
      await updateRollup.mutateAsync({
        rollupId: rollupBoard.id,
        input: {
          ...(hasNameChanged && { name: name.trim() }),
          ...(hasReviewModeChanged && { reviewModeEnabled }),
        },
      });
    }

    // Update sources if changed
    if (hasBoardsChanged) {
      await updateSources.mutateAsync({
        rollupBoardId: rollupBoard.id,
        sourceBoardIds: selectedBoardIds,
      });
    }

    router.push(`/rollups/${rollupBoard.id}`);
  };

  const handleDelete = () => {
    deleteRollup.mutate(rollupBoard.id, {
      onSuccess: () => {
        router.push('/rollups');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update rollup name and source boards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., All Client Tasks, Weekly Overview"
              disabled={isSaving}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Source Boards */}
          <div className="space-y-2">
            <Label>Source Boards</Label>
            <p className="text-sm text-muted-foreground">
              Select the boards to aggregate tasks from
            </p>
            {isLoadingBoards ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading boards...
              </div>
            ) : (
              <RollupSourceSelector
                value={selectedBoardIds}
                onChange={setSelectedBoardIds}
                boards={availableBoards}
                disabled={isSaving}
                placeholder="Select source boards..."
              />
            )}
            {errors.boards && (
              <p className="text-sm text-destructive">{errors.boards}</p>
            )}
          </div>

          {/* Review Mode */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="review-mode">Review Mode</Label>
              <p className="text-sm text-muted-foreground">
                Step through swimlanes one at a time with keyboard navigation
              </p>
            </div>
            <Switch
              id="review-mode"
              checked={reviewModeEnabled}
              onCheckedChange={setReviewModeEnabled}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>

      {/* Sharing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Sharing
          </CardTitle>
          <CardDescription>
            Control who can view this rollup board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RollupSharingDialog
            rollupBoardId={rollupBoard.id}
            rollupName={rollupBoard.name}
          />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this rollup board. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteRollup.isPending}>
                {deleteRollup.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Delete Rollup
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete rollup board?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the rollup board &quot;{rollupBoard.name}&quot;.
                  This action cannot be undone. The source boards and their tasks will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
