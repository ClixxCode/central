'use client';

import { forwardRef, useRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { TaskEditor, type TaskEditorProps, type TaskEditorRef } from './TaskEditor';
import { EditorToolbar } from './EditorToolbar';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import type { Editor } from '@tiptap/react';

export interface RichTextEditorProps extends Omit<TaskEditorProps, 'className'> {
  showToolbar?: boolean;
  className?: string;
  editorClassName?: string;
}

export interface RichTextEditorRef {
  getContent: () => TiptapContent | null;
  setContent: (content: TiptapContent | null) => void;
  focus: () => void;
  getEditor: () => Editor | null;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(
    {
      showToolbar = true,
      className,
      editorClassName,
      editable = true,
      ...props
    },
    ref
  ) {
    const editorRef = useRef<TaskEditorRef>(null);

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => editorRef.current?.getContent() ?? null,
        setContent: (content) => editorRef.current?.setContent(content),
        focus: () => editorRef.current?.focus(),
        getEditor: () => editorRef.current?.getEditor() ?? null,
      }),
      []
    );

    const editor = editorRef.current?.getEditor() ?? null;

    return (
      <div
        className={cn(
          'rounded-md border border-input bg-transparent overflow-hidden',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          !editable && 'bg-muted/50',
          className
        )}
      >
        {showToolbar && editable && <EditorToolbar editor={editor} />}
        <TaskEditor
          ref={editorRef}
          editable={editable}
          className="border-0 focus-within:ring-0 focus-within:ring-offset-0 [&>div]:border-0 [&>div]:focus-within:ring-0"
          {...props}
        />
      </div>
    );
  }
);
