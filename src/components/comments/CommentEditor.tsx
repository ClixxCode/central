'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskEditor, type TaskEditorRef } from '@/components/editor/TaskEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { FileUpload, type UploadedFile } from '@/components/attachments/FileUpload';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import type { FileMentionItem } from '@/components/editor/FileMentionList';
import { cn } from '@/lib/utils';
import { Send, Paperclip, Loader2, X } from 'lucide-react';

interface CommentEditorProps {
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  mentionUsers?: MentionUser[];
  taskAttachments?: FileMentionItem[];
  onSubmit: (content: TiptapContent, attachments?: PendingAttachment[]) => Promise<void>;
  placeholder?: string;
  className?: string;
  /** Called when a file mention is clicked */
  onFileMentionClick?: (attachmentId: string) => void;
  /** Called when user picks "Upload new file..." from the + menu */
  onUploadAttachment?: () => Promise<FileMentionItem | null>;
}

export interface PendingAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export function CommentEditor({
  currentUser,
  mentionUsers = [],
  taskAttachments = [],
  onSubmit,
  placeholder = 'Write a comment...',
  className,
  onFileMentionClick,
  onUploadAttachment,
}: CommentEditorProps) {
  const editorRef = useRef<TaskEditorRef>(null);
  const [content, setContent] = useState<TiptapContent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [editorReady, setEditorReady] = useState(false);

  // Force re-render when editor is ready to show toolbar
  useEffect(() => {
    const timer = setTimeout(() => setEditorReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const hasContent = content && content.content && content.content.length > 0;
  const hasAttachments = pendingAttachments.length > 0;
  const canSubmit = (hasContent || hasAttachments) && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content ?? { type: 'doc', content: [] }, pendingAttachments.length > 0 ? pendingAttachments : undefined);

      // Clear form on success
      setContent(null);
      editorRef.current?.setContent(null);
      setPendingAttachments([]);
      setShowAttachments(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, content, pendingAttachments, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleUploadComplete = useCallback((files: UploadedFile[]) => {
    const newAttachments: PendingAttachment[] = files.map((file) => ({
      id: file.key,
      filename: file.name,
      url: file.url,
      size: file.size,
      mimeType: file.type,
    }));
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch('/api/blob', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.files[0].url;
  }, []);

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/30',
        className
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Current user avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={currentUser.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(currentUser.name ?? currentUser.email)}
          </AvatarFallback>
        </Avatar>

        {/* Editor area */}
        <div className="min-w-0 flex-1">
          <div className="rounded-md border border-black/15 dark:border-border">
            {/* Toolbar */}
            {editorReady && editorRef.current?.getEditor() && (
              <EditorToolbar
                editor={editorRef.current.getEditor()}
                onUploadImage={handleUploadImage}
                className="border-b"
              />
            )}
            <div
              onKeyDown={handleKeyDown}
            >
              <TaskEditor
                ref={editorRef}
                content={content}
                onChange={setContent}
                users={mentionUsers}
                attachments={taskAttachments}
                onUploadImage={handleUploadImage}
                onUploadAttachment={onUploadAttachment}
                placeholder={placeholder}
                className="[&>div]:border-0 [&>div]:p-0 [&>div]:focus-within:ring-0"
                minHeight="80px"
                onFileMentionClick={onFileMentionClick}
              />
            </div>
          </div>

          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <div className="flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-32 truncate">{attachment.filename}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File upload area */}
          {showAttachments && (
            <div className="mt-2 border-t pt-2">
              <FileUpload
                endpoint="attachmentUploader"
                onUploadComplete={handleUploadComplete}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAttachments(!showAttachments)}
            className={cn(showAttachments && 'bg-muted')}
          >
            <Paperclip className="mr-1 h-4 w-4" />
            Attach file
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Press{' '}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
                ? '⌘'
                : 'Ctrl'}
            </kbd>
            +
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            to send
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Send
          </Button>
        </div>
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
