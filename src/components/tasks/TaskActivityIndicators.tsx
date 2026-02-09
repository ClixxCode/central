'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MessageSquare, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TaskActivityIndicatorsProps {
  commentCount: number;
  attachmentCount: number;
  hasNewComments: boolean;
  className?: string;
}

export function TaskActivityIndicators({
  commentCount,
  attachmentCount,
  hasNewComments,
  className,
}: TaskActivityIndicatorsProps) {
  // Don't render anything if no activity
  if (commentCount === 0 && attachmentCount === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {/* Comment count */}
      {commentCount > 0 && (
        <div className="flex items-center gap-0.5">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{commentCount}</span>
        </div>
      )}

      {/* Attachment count */}
      {attachmentCount > 0 && (
        <div className="flex items-center gap-0.5">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{attachmentCount}</span>
        </div>
      )}

      {/* New badge */}
      {hasNewComments && (
        <Badge
          variant="default"
          className="h-4 px-1 py-0 text-[10px] font-medium bg-blue-500 hover:bg-blue-500"
        >
          NEW
        </Badge>
      )}
    </div>
  );
}
