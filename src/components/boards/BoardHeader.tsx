'use client';

import React from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/shared/FavoriteButton';

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  clientName?: string;
  clientSlug: string;
  canEdit: boolean;
}

export function BoardHeader({
  boardId,
  boardName,
  clientName,
  clientSlug,
  canEdit,
}: BoardHeaderProps) {
  return (
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
  );
}
