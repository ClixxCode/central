'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskEditor, type TaskEditorRef } from '@/components/editor/TaskEditor';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { ImageLightbox } from '@/components/attachments/ImageLightbox';
import type { CommentWithAuthor } from '@/lib/actions/comments';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Pencil, Trash2, X, Check, Loader2, Reply, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId: string;
  isAdmin?: boolean;
  mentionUsers?: MentionUser[];
  onUpdate?: (id: string, content: TiptapContent) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** Called when a file mention is clicked */
  onFileMentionClick?: (attachmentId: string) => void;
  /** Whether this comment should be highlighted (from notification links) */
  isHighlighted?: boolean;
  /** Whether this is a reply (renders with smaller avatar, no Reply button) */
  isReply?: boolean;
  /** Called when the Reply button is clicked (top-level comments only) */
  onReply?: (commentId: string) => void;
  /** Number of replies on this comment */
  replyCount?: number;
}

export function CommentItem({
  comment,
  currentUserId,
  isAdmin,
  mentionUsers = [],
  onUpdate,
  onDelete,
  onFileMentionClick,
  isHighlighted,
  isReply,
  onReply,
  replyCount = 0,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<TiptapContent | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editorRef = useRef<TaskEditorRef>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  const [showHighlight, setShowHighlight] = useState(false);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);

  // Scroll into view and flash highlight when this comment is highlighted, then fade after 2s
  useEffect(() => {
    if (isHighlighted && commentRef.current) {
      commentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const isAuthor = comment.author && comment.authorId === currentUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;
  const isDeletedAuthor = !comment.author;
  const isDeactivatedAuthor = !isDeletedAuthor && !!(comment.author as { deactivatedAt?: Date | null }).deactivatedAt;

  const handleStartEdit = useCallback(() => {
    setEditContent(comment.content);
    setIsEditing(true);
  }, [comment.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editContent || !onUpdate) return;

    setIsUpdating(true);
    try {
      await onUpdate(comment.id, editContent);
      setIsEditing(false);
      setEditContent(null);
    } finally {
      setIsUpdating(false);
    }
  }, [comment.id, editContent, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  }, [comment.id, onDelete]);

  const handleCopyLink = useCallback(() => {
    if (!comment.shortId) return;
    const url = `${window.location.origin}/c/${comment.shortId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }, [comment.shortId]);

  const createdDate = new Date(comment.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const absoluteTime = format(createdDate, 'MMM d, yyyy h:mm a');

  const wasEdited = comment.updatedAt && comment.updatedAt > comment.createdAt;

  return (
    <div
      ref={commentRef}
      className={cn(
        'group relative flex gap-3 rounded-none p-3 transition-all duration-700',
        'hover:bg-muted/50',
        isReply ? 'border-l-2 border-l-border' : 'border-l-[3px] border-l-primary/30',
        isDeleting && 'pointer-events-none opacity-50',
        showHighlight && 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
      )}
    >
      {/* Author avatar */}
      <Avatar className={cn('shrink-0', isReply ? 'h-6 w-6' : 'h-8 w-8', (isDeactivatedAuthor || isDeletedAuthor) && 'opacity-50 grayscale')}>
        <AvatarImage src={comment.author?.avatarUrl ?? undefined} />
        <AvatarFallback className={cn(isReply ? 'text-[10px]' : 'text-xs')}>
          {isDeletedAuthor ? 'DU' : getInitials(comment.author!.name ?? comment.author!.email)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <span className={cn('text-sm font-medium', (isDeactivatedAuthor || isDeletedAuthor) && 'text-muted-foreground')}>
            {isDeletedAuthor
              ? 'Deleted user'
              : (comment.author!.name ?? comment.author!.email.split('@')[0]) + (isDeactivatedAuthor ? ' (deactivated)' : '')}
          </span>
          <span
            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setShowAbsoluteTime(!showAbsoluteTime)}
            title={showAbsoluteTime ? timeAgo : absoluteTime}
          >
            {showAbsoluteTime ? absoluteTime : timeAgo}
          </span>
          {wasEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="space-y-2">
            <div className="rounded-md border">
              <TaskEditor
                ref={editorRef}
                content={editContent}
                onChange={setEditContent}
                users={mentionUsers}
                placeholder="Edit your comment..."
                className="[&>div]:border-0 [&>div]:focus-within:ring-0"
                minHeight="80px"
                onFileMentionClick={onFileMentionClick}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isUpdating || !editContent}
              >
                {isUpdating ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Read-only Tiptap content */}
            <div className="prose prose-sm max-w-none text-sm">
              <TaskEditor
                content={comment.content}
                editable={false}
                className="[&>div]:border-0 [&>div]:p-0 [&>div]:focus-within:ring-0"
                minHeight="auto"
                onFileMentionClick={onFileMentionClick}
              />
            </div>

            {/* Attachments */}
            {comment.attachments.length > 0 && (() => {
              const images = comment.attachments.filter((a) => a.mimeType?.startsWith('image/'));
              const files = comment.attachments.filter((a) => !a.mimeType?.startsWith('image/'));
              return (
                <div className="mt-2 space-y-2">
                  {images.length > 0 && (
                    <ImageLightbox images={images} />
                  )}
                  {files.length > 0 && (
                    <AttachmentList
                      attachments={files.map((a) => ({
                        id: a.id,
                        filename: a.filename,
                        url: a.url,
                        size: a.size,
                        mimeType: a.mimeType,
                      }))}
                      showDelete={false}
                      emptyMessage=""
                    />
                  )}
                </div>
              );
            })()}

            {/* Reply button (hover-only) */}
            {onReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
              >
                <Reply className="h-3 w-3" />
                Reply
                {!isReply && replyCount > 0 && (
                  <span className="text-muted-foreground">({replyCount})</span>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Actions menu */}
      {!isEditing && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Comment actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {comment.shortId && (
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem onClick={handleStartEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
