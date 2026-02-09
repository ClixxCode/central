'use client';

import { CommentThread as CommentThreadComponent } from './CommentThread';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommentThread } from '@/lib/hooks/useComments';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import { MessageSquare } from 'lucide-react';

interface CommentListProps {
  threads: CommentThread[];
  currentUserId: string;
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  isAdmin?: boolean;
  mentionUsers?: MentionUser[];
  isLoading?: boolean;
  onUpdate?: (id: string, content: TiptapContent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onReply?: (parentCommentId: string, content: TiptapContent) => Promise<void>;
  onFileMentionClick?: (attachmentId: string) => void;
  highlightedCommentId?: string;
}

export function CommentList({
  threads,
  currentUserId,
  currentUser,
  isAdmin,
  mentionUsers = [],
  isLoading,
  onUpdate,
  onDelete,
  onReply,
  onFileMentionClick,
  highlightedCommentId,
}: CommentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <CommentSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to add one!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {threads.map((thread) => (
        <CommentThreadComponent
          key={thread.comment.id}
          thread={thread}
          currentUserId={currentUserId}
          currentUser={currentUser}
          isAdmin={isAdmin}
          mentionUsers={mentionUsers}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onReply={onReply}
          onFileMentionClick={onFileMentionClick}
          highlightedCommentId={highlightedCommentId}
        />
      ))}
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
