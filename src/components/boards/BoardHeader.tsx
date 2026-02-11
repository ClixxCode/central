'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { SaveBoardAsTemplateDialog } from '@/components/templates/SaveBoardAsTemplateDialog';

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  clientName?: string;
  clientSlug: string;
  canEdit: boolean;
  taskCount?: number;
}

export function BoardHeader({
  boardId,
  boardName,
  clientName,
  clientSlug,
  canEdit,
  taskCount,
}: BoardHeaderProps) {
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold">{boardName}</h1>
            {clientName && (
              <Link
                href={`/clients/${clientSlug}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {clientName}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSaveAsTemplateOpen(true)}>
            <LayoutTemplate className="mr-2 size-4" />
            Save as Template
          </Button>
          <FavoriteButton entityType="board" entityId={boardId} />
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clients/${clientSlug}/boards/${boardId}/settings`}>
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </Button>
          )}
        </div>
      </div>

      <SaveBoardAsTemplateDialog
        open={saveAsTemplateOpen}
        onOpenChange={setSaveAsTemplateOpen}
        boardId={boardId}
        boardName={boardName}
        taskCount={taskCount}
      />
    </>
  );
}
