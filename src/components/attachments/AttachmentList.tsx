'use client';

import { cn } from '@/lib/utils';
import { AttachmentPreview, type Attachment } from './AttachmentPreview';
import { Paperclip } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AttachmentListProps {
  attachments: Attachment[];
  onDelete?: (id: string) => void;
  showDelete?: boolean;
  emptyMessage?: string;
  className?: string;
  layout?: 'list' | 'grid';
  /** ID of attachment to highlight and scroll to */
  highlightedId?: string | null;
}

export function AttachmentList({
  attachments,
  onDelete,
  showDelete = false,
  emptyMessage = 'No attachments',
  className,
  layout = 'list',
  highlightedId,
}: AttachmentListProps) {
  const highlightRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted attachment when it changes
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId]);

  if (attachments.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 text-center',
          className
        )}
      >
        <Paperclip className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        layout === 'grid'
          ? 'grid gap-3 sm:grid-cols-2'
          : 'flex flex-col gap-2',
        className
      )}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          ref={attachment.id === highlightedId ? highlightRef : undefined}
          className={cn(
            'rounded-md transition-all duration-500',
            attachment.id === highlightedId && 'ring-2 ring-primary ring-offset-2 bg-primary/5 animate-pulse'
          )}
        >
          <AttachmentPreview
            attachment={attachment}
            onDelete={onDelete}
            showDelete={showDelete}
          />
        </div>
      ))}
    </div>
  );
}
