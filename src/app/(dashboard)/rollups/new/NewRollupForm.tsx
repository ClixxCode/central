'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RollupSourceSelector } from '@/components/rollups/RollupSourceSelector';
import {
  useCreateRollupBoard,
  useAvailableSourceBoards,
} from '@/lib/hooks/useRollupBoards';

export function NewRollupForm() {
  const router = useRouter();
  const createRollup = useCreateRollupBoard();
  const { data: availableBoards = [], isLoading: isLoadingBoards } =
    useAvailableSourceBoards();

  const [name, setName] = React.useState('');
  const [selectedBoardIds, setSelectedBoardIds] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<{
    name?: string;
    boards?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    createRollup.mutate(
      {
        name: name.trim(),
        sourceBoardIds: selectedBoardIds,
      },
      {
        onSuccess: (data) => {
          router.push(`/rollups/${data.id}`);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Rollup Details</CardTitle>
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
              disabled={createRollup.isPending}
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
            ) : availableBoards.length === 0 ? (
              <p className="py-4 text-muted-foreground">
                No boards available. Create some boards first.
              </p>
            ) : (
              <RollupSourceSelector
                value={selectedBoardIds}
                onChange={setSelectedBoardIds}
                boards={availableBoards}
                disabled={createRollup.isPending}
                placeholder="Select source boards..."
              />
            )}
            {errors.boards && (
              <p className="text-sm text-destructive">{errors.boards}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createRollup.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createRollup.isPending || availableBoards.length === 0}
          >
            {createRollup.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Create Rollup
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
