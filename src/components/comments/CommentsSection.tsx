'use client';

import { useCallback } from 'react';
import { CommentList } from './CommentList';
import { CommentEditor, type PendingAttachment } from './CommentEditor';
import { useCommentThreads, useCreateComment, useUpdateComment, useDeleteComment, useToggleCommentReaction } from '@/lib/hooks/useComments';
import { useMentionableUsers } from '@/lib/hooks/useQuickAdd';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import type { FileMentionItem } from '@/components/editor/FileMentionList';
import type { CommentReactionType } from '@/lib/comments/reactions';

interface CommentsSectionProps {
  taskId: string;
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  isAdmin?: boolean;
  mentionUsers?: MentionUser[];
  taskAttachments?: FileMentionItem[];
  /** Called when a file mention is clicked in a comment */
  onFileMentionClick?: (attachmentId: string) => void;
  /** Called when user picks "Upload new file..." from the + menu */
  onUploadAttachment?: () => Promise<FileMentionItem | null>;
  /** Optional comment ID to highlight (from notification links) */
  highlightedCommentId?: string;
}

export function CommentsSection({
  taskId,
  currentUser,
  isAdmin,
  mentionUsers = [],
  taskAttachments = [],
  onFileMentionClick,
  onUploadAttachment,
  highlightedCommentId,
}: CommentsSectionProps) {
  // Fetch all users for mention suggestions (anyone can be mentioned)
  const { data: allMentionUsers = [] } = useMentionableUsers();
  const resolvedMentionUsers: MentionUser[] = allMentionUsers.length > 0
    ? allMentionUsers
    : mentionUsers;

  // Fetch comments grouped into threads
  const { threads, isLoading } = useCommentThreads(taskId);

  // Mutations
  const createComment = useCreateComment();
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const toggleReaction = useToggleCommentReaction(taskId);

  // Handlers
  const handleSubmit = useCallback(
    async (content: TiptapContent, attachments?: PendingAttachment[]) => {
      await createComment.mutateAsync({
        taskId,
        contentJson: JSON.stringify(content),
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          url: a.url,
          size: a.size,
          mimeType: a.mimeType,
        })),
      });
    },
    [taskId, createComment]
  );

  const handleUpdate = useCallback(
    async (id: string, content: TiptapContent) => {
      await updateComment.mutateAsync({ id, contentJson: JSON.stringify(content) });
    },
    [updateComment]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteComment.mutateAsync(id);
    },
    [deleteComment]
  );

  const handleReply = useCallback(
    async (parentCommentId: string, content: TiptapContent) => {
      await createComment.mutateAsync({
        taskId,
        contentJson: JSON.stringify(content),
        parentCommentId,
      });
    },
    [taskId, createComment]
  );

  const handleToggleReaction = useCallback(
    async (commentId: string, reaction: CommentReactionType) => {
      await toggleReaction.mutateAsync({ commentId, reaction });
    },
    [toggleReaction]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Comment editor at the top */}
      <CommentEditor
        currentUser={currentUser}
        mentionUsers={resolvedMentionUsers}
        taskAttachments={taskAttachments}
        onSubmit={handleSubmit}
        onFileMentionClick={onFileMentionClick}
        onUploadAttachment={onUploadAttachment}
        placeholder="Add a comment... (+ to reference attachments)"
      />

      {/* Comments list */}
      <CommentList
        threads={threads}
        currentUserId={currentUser.id}
        currentUser={currentUser}
        isAdmin={isAdmin}
        mentionUsers={resolvedMentionUsers}
        isLoading={isLoading}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onReply={handleReply}
        onToggleReaction={handleToggleReaction}
        isTogglingReaction={toggleReaction.isPending}
        onFileMentionClick={onFileMentionClick}
        highlightedCommentId={highlightedCommentId}
      />
    </div>
  );
}
