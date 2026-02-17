'use client';

import { useState, useCallback } from 'react';
import { CommentItem } from './CommentItem';
import { ReplyEditor } from './ReplyEditor';
import type { CommentThread as CommentThreadType } from '@/lib/hooks/useComments';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';

interface CommentThreadProps {
  thread: CommentThreadType;
  currentUserId: string;
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  isAdmin?: boolean;
  mentionUsers?: MentionUser[];
  onUpdate?: (id: string, content: TiptapContent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onReply?: (parentCommentId: string, content: TiptapContent) => Promise<void>;
  onFileMentionClick?: (attachmentId: string) => void;
  highlightedCommentId?: string;
}

export function CommentThread({
  thread,
  currentUserId,
  currentUser,
  isAdmin,
  mentionUsers = [],
  onUpdate,
  onDelete,
  onReply,
  onFileMentionClick,
  highlightedCommentId,
}: CommentThreadProps) {
  const [showReplyEditor, setShowReplyEditor] = useState(false);

  const handleReply = useCallback(
    async (content: TiptapContent) => {
      if (onReply) {
        await onReply(thread.comment.id, content);
        setShowReplyEditor(false);
      }
    },
    [onReply, thread.comment.id]
  );

  const hasReplies = thread.replies.length > 0 || showReplyEditor;

  return (
    <div>
      {/* Top-level comment */}
      <CommentItem
        comment={thread.comment}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        mentionUsers={mentionUsers}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onFileMentionClick={onFileMentionClick}
        isHighlighted={thread.comment.id === highlightedCommentId}
        onReply={() => setShowReplyEditor(true)}
        replyCount={thread.replies.length}
      />

      {/* Replies + reply editor */}
      {hasReplies && (
        <div style={{ paddingLeft: 48 }}>
          {thread.replies.length > 0 && (
            <div className="space-y-1">
              {thread.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  mentionUsers={mentionUsers}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onFileMentionClick={onFileMentionClick}
                  isHighlighted={reply.id === highlightedCommentId}
                  isReply
                  onReply={() => setShowReplyEditor(true)}
                />
              ))}
            </div>
          )}

          {showReplyEditor && (
            <ReplyEditor
              currentUser={currentUser}
              mentionUsers={mentionUsers}
              onSubmit={handleReply}
              onCancel={() => setShowReplyEditor(false)}
              autoFocus
            />
          )}
        </div>
      )}
    </div>
  );
}
