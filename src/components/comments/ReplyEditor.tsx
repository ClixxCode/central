'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskEditor, type TaskEditorRef } from '@/components/editor/TaskEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { isContentEmpty } from '@/lib/editor/mentions';

interface ReplyEditorProps {
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  mentionUsers?: MentionUser[];
  onSubmit: (content: TiptapContent) => Promise<void>;
  onCancel: () => void;
  autoFocus?: boolean;
}

export function ReplyEditor({
  currentUser,
  mentionUsers = [],
  onSubmit,
  onCancel,
  autoFocus = true,
}: ReplyEditorProps) {
  const [content, setContent] = useState<TiptapContent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<TaskEditorRef>(null);

  // Auto-focus editor on mount
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure editor is mounted
      const timer = setTimeout(() => editorRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Wait for editor to be ready before showing toolbar
  useEffect(() => {
    const timer = setTimeout(() => setEditorReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const canSubmit = content && !isContentEmpty(content) && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!content || isContentEmpty(content)) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent(null);
      editorRef.current?.setContent(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) {
          handleSubmit();
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [canSubmit, handleSubmit, onCancel]
  );

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

  const initials = getInitials(currentUser.name ?? currentUser.email);

  return (
    <div className="flex gap-2 rounded-lg bg-muted/70 p-3" onKeyDown={handleKeyDown}>
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={currentUser.avatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-md border border-black/15 dark:border-border">
          {editorReady && editorRef.current?.getEditor() && (
            <EditorToolbar
              editor={editorRef.current.getEditor()}
              onUploadImage={handleUploadImage}
              className="border-b"
            />
          )}
          <TaskEditor
            ref={editorRef}
            content={content}
            onChange={setContent}
            users={mentionUsers}
            onUploadImage={handleUploadImage}
            placeholder="Write a reply..."
            className="[&>div]:border-0 [&>div]:focus-within:ring-0"
            minHeight="60px"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Reply
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
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
