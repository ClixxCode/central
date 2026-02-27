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
import type { CommentReactionType } from '@/lib/comments/reactions';
import { MoreHorizontal, Pencil, Trash2, X, Check, Loader2, Reply, Link2, ThumbsUp, Eye, Plus, BadgeCheck, Handshake, Heart, PartyPopper, Flame, Award, Star, Rocket, Coffee, Sparkles, Hammer, NotebookPen, Lightbulb, CircleQuestionMark } from 'lucide-react';
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
  /** Toggle a comment reaction */
  onToggleReaction?: (commentId: string, reaction: CommentReactionType) => Promise<void>;
  /** Whether a reaction request is in-flight */
  isTogglingReaction?: boolean;
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
  onToggleReaction,
  isTogglingReaction,
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
  const reactionStateByType = new Map(comment.reactions.map((reaction) => [reaction.reaction, reaction] as const));
  const quickReactionOptions = QUICK_REACTION_VALUES
    .map((reactionValue) => REACTION_OPTIONS.find((option) => option.value === reactionValue))
    .filter((option): option is (typeof REACTION_OPTIONS)[number] => Boolean(option));
  const extraReactionOptions = REACTION_OPTIONS.filter((option) => {
    if (QUICK_REACTION_VALUES.includes(option.value)) return false;
    const state = reactionStateByType.get(option.value);
    return (state?.count ?? 0) > 0;
  });

  return (
    <div
      ref={commentRef}
      className={cn(
        'group relative flex gap-3 rounded-xl border px-4 py-3 transition-all duration-300',
        isReply
          ? 'border-border/70 bg-muted/20'
          : 'border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        'hover:border-border hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)]',
        isDeleting && 'pointer-events-none opacity-50',
        showHighlight && 'ring-2 ring-blue-500/70 bg-blue-50/50 dark:bg-blue-500/10'
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
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate text-sm font-semibold', (isDeactivatedAuthor || isDeletedAuthor) && 'text-muted-foreground')}>
              {isDeletedAuthor
                ? 'Deleted user'
                : (comment.author!.name ?? comment.author!.email.split('@')[0]) + (isDeactivatedAuthor ? ' (deactivated)' : '')}
            </span>
            <span
              className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowAbsoluteTime(!showAbsoluteTime)}
              title={showAbsoluteTime ? timeAgo : absoluteTime}
            >
              {showAbsoluteTime ? absoluteTime : timeAgo}
            </span>
            {wasEdited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1 opacity-60 transition-all duration-200 group-hover:opacity-100">
              {comment.shortId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="h-7 w-7 rounded-full hover:scale-105"
                  title="Copy link"
                >
                  <Link2 className="h-4 w-4" />
                  <span className="sr-only">Copy link</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:scale-105">
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
            <div className="mt-2 flex items-center gap-2">
              {onReply && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onReply(comment.id)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground opacity-75 transition-all duration-200 hover:scale-[1.02] hover:text-foreground group-hover:opacity-100"
                >
                  <Reply className="h-3.5 w-3.5" />
                  Reply
                  {!isReply && replyCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">{replyCount}</span>
                  )}
                </Button>
              )}
              {onToggleReaction && (
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isTogglingReaction}
                        className={cn(
                          'h-7 gap-1 px-2 text-xs opacity-75 transition-all duration-200 hover:scale-[1.02] group-hover:opacity-100',
                          comment.reactions.some((r) => r.reacted)
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        React
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {REACTION_OPTIONS.map(({ value, label, Icon, color, menuBg, menuBorder }) => {
                        const reacted = comment.reactions.some(
                          (reaction) => reaction.reaction === value && reaction.reacted
                        );
                        return (
                          <DropdownMenuItem
                            key={value}
                            onClick={() => onToggleReaction(comment.id, value)}
                            className="gap-2"
                          >
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
                              style={{ backgroundColor: menuBg, borderColor: menuBorder }}
                            >
                              <Icon className="h-3.5 w-3.5" style={{ color }} />
                            </span>
                            <span>{label}</span>
                            {reacted && <Check className="ml-auto h-4 w-4 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {[...quickReactionOptions, ...extraReactionOptions].map(({ value, Icon, label, color, pillBg, pillBorder, pillActiveBg, pillActiveBorder }) => {
                    const state = reactionStateByType.get(value);
                    const count = state?.count ?? 0;
                    const isInactive = count === 0 && !state?.reacted;
                    const mutedStyle = {
                      color: 'var(--muted-foreground)',
                      backgroundColor: 'transparent',
                      opacity: 0.75,
                    };

                    return (
                      <Button
                        key={value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        title={label}
                        disabled={isTogglingReaction}
                        onClick={() => onToggleReaction(comment.id, value)}
                        className={cn(
                          'h-7 gap-1 rounded-full border px-2 text-[11px] transition-all duration-200 hover:scale-[1.03]',
                          isInactive && 'border-transparent hover:border-border/50 hover:bg-muted/30'
                        )}
                        style={
                          isInactive
                            ? mutedStyle
                            : state?.reacted
                              ? { color, backgroundColor: pillActiveBg, borderColor: pillActiveBorder }
                              : { color, backgroundColor: pillBg, borderColor: pillBorder }
                        }
                      >
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: isInactive ? 'var(--muted-foreground)' : color }}
                        />
                        {count > 0 && <span>{count}</span>}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
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

const REACTION_OPTIONS: {
  value: CommentReactionType;
  label: string;
  Icon: typeof ThumbsUp;
  color: string;
  menuBg: string;
  menuBorder: string;
  pillBg: string;
  pillBorder: string;
  pillActiveBg: string;
  pillActiveBorder: string;
}[] = [
  { value: 'coffee', label: 'Discuss', Icon: Coffee, color: '#b45309', menuBg: '#fffbeb', menuBorder: '#fcd34d', pillBg: '#fffbeb', pillBorder: '#fde68a', pillActiveBg: '#fef3c7', pillActiveBorder: '#f59e0b' },
  { value: 'rocket', label: 'Lets go', Icon: Rocket, color: '#2563eb', menuBg: '#eff6ff', menuBorder: '#bfdbfe', pillBg: '#eff6ff', pillBorder: '#bfdbfe', pillActiveBg: '#dbeafe', pillActiveBorder: '#60a5fa' },
  { value: 'sparkles', label: 'Polished', Icon: Sparkles, color: '#c026d3', menuBg: '#fdf4ff', menuBorder: '#f5d0fe', pillBg: '#fdf4ff', pillBorder: '#f5d0fe', pillActiveBg: '#fae8ff', pillActiveBorder: '#d946ef' },
  { value: 'clap', label: 'Kudos', Icon: Award, color: '#7c3aed', menuBg: '#f5f3ff', menuBorder: '#ddd6fe', pillBg: '#f5f3ff', pillBorder: '#ddd6fe', pillActiveBg: '#ede9fe', pillActiveBorder: '#8b5cf6' },
  { value: 'fire', label: 'Impressive', Icon: Flame, color: '#ea580c', menuBg: '#fff7ed', menuBorder: '#fed7aa', pillBg: '#fff7ed', pillBorder: '#fed7aa', pillActiveBg: '#ffedd5', pillActiveBorder: '#fb923c' },
  { value: 'star', label: 'Excellent', Icon: Star, color: '#ca8a04', menuBg: '#fefce8', menuBorder: '#fde68a', pillBg: '#fefce8', pillBorder: '#fde68a', pillActiveBg: '#fef9c3', pillActiveBorder: '#eab308' },
  { value: 'notes', label: 'Notes', Icon: NotebookPen, color: '#0f766e', menuBg: '#f0fdfa', menuBorder: '#99f6e4', pillBg: '#f0fdfa', pillBorder: '#99f6e4', pillActiveBg: '#ccfbf1', pillActiveBorder: '#14b8a6' },
  { value: 'hundred', label: 'Perfect', Icon: BadgeCheck, color: '#e11d48', menuBg: '#fff1f2', menuBorder: '#fecdd3', pillBg: '#fff1f2', pillBorder: '#fecdd3', pillActiveBg: '#ffe4e6', pillActiveBorder: '#fb7185' },
  { value: 'celebrate', label: 'Celebrate', Icon: PartyPopper, color: '#db2777', menuBg: '#fdf2f8', menuBorder: '#fbcfe8', pillBg: '#fdf2f8', pillBorder: '#fbcfe8', pillActiveBg: '#fce7f3', pillActiveBorder: '#ec4899' },
  { value: 'fixing', label: 'Fixing', Icon: Hammer, color: '#a16207', menuBg: '#fffbeb', menuBorder: '#fde68a', pillBg: '#fffbeb', pillBorder: '#fde68a', pillActiveBg: '#fef3c7', pillActiveBorder: '#f59e0b' },
  { value: 'idea', label: 'Idea', Icon: Lightbulb, color: '#65a30d', menuBg: '#f7fee7', menuBorder: '#bef264', pillBg: '#f7fee7', pillBorder: '#bef264', pillActiveBg: '#ecfccb', pillActiveBorder: '#84cc16' },
  { value: 'question', label: 'Need info', Icon: CircleQuestionMark, color: '#0e7490', menuBg: '#ecfeff', menuBorder: '#a5f3fc', pillBg: '#ecfeff', pillBorder: '#a5f3fc', pillActiveBg: '#cffafe', pillActiveBorder: '#22d3ee' },
  { value: 'handshake', label: 'Agreement', Icon: Handshake, color: '#059669', menuBg: '#ecfdf5', menuBorder: '#a7f3d0', pillBg: '#ecfdf5', pillBorder: '#a7f3d0', pillActiveBg: '#d1fae5', pillActiveBorder: '#34d399' },
  { value: 'plus_one', label: 'Plus one', Icon: Plus, color: '#4f46e5', menuBg: '#eef2ff', menuBorder: '#c7d2fe', pillBg: '#eef2ff', pillBorder: '#c7d2fe', pillActiveBg: '#e0e7ff', pillActiveBorder: '#818cf8' },
  { value: 'check', label: 'Check mark', Icon: Check, color: '#16a34a', menuBg: '#f0fdf4', menuBorder: '#bbf7d0', pillBg: '#f0fdf4', pillBorder: '#bbf7d0', pillActiveBg: '#dcfce7', pillActiveBorder: '#4ade80' },
  { value: 'eyes', label: 'Reviewing', Icon: Eye, color: '#2563eb', menuBg: '#eff6ff', menuBorder: '#bfdbfe', pillBg: '#eff6ff', pillBorder: '#bfdbfe', pillActiveBg: '#dbeafe', pillActiveBorder: '#60a5fa' },
  { value: 'thanks', label: 'Thanks', Icon: Heart, color: '#e11d48', menuBg: '#fff1f2', menuBorder: '#fecdd3', pillBg: '#fff1f2', pillBorder: '#fecdd3', pillActiveBg: '#ffe4e6', pillActiveBorder: '#fb7185' },
  { value: 'thumbs_up', label: 'Thumbs up', Icon: ThumbsUp, color: '#059669', menuBg: '#ecfdf5', menuBorder: '#a7f3d0', pillBg: '#ecfdf5', pillBorder: '#a7f3d0', pillActiveBg: '#d1fae5', pillActiveBorder: '#34d399' },
];

const QUICK_REACTION_VALUES: CommentReactionType[] = ['thumbs_up', 'thanks', 'eyes'];
