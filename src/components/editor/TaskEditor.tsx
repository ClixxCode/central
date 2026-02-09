'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Suggestion } from '@tiptap/suggestion';
import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import { MentionList, type MentionUser } from './MentionList';
import { FileMentionList, type FileMentionItem } from './FileMentionList';

// Custom Link extension with proper attribute handling
const CustomLink = Link.extend({
  inclusive: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
      },
      target: {
        default: '_blank',
      },
      rel: {
        default: 'noopener noreferrer',
      },
      class: {
        default: 'text-primary underline underline-offset-2 hover:text-primary/80',
      },
    };
  },
});

// Custom Mention extension for user mentions - using Mention extension with explicit attribute handling
const UserMention = Mention.extend({
  name: 'mention',
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
      mentionSuggestionChar: {
        default: '@',
        parseHTML: (element) => element.getAttribute('data-mention-suggestion-char'),
        renderHTML: (attributes) => {
          return { 'data-mention-suggestion-char': attributes.mentionSuggestionChar };
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'mention',
        class: 'mention bg-primary/10 text-primary rounded px-1 py-0.5 font-medium',
      }),
      `@${node.attrs.label || 'Unknown'}`,
    ];
  },
});

// Custom File Mention extension - create as a full custom Node (not extending Mention)
const FileMention = Node.create({
  name: 'fileMention',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,
  
  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '+',
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url') || element.getAttribute('href'),
        renderHTML: (attributes) => {
          if (!attributes.url) return {};
          return { 'data-url': attributes.url, href: attributes.url };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="fileMention"]',
      },
      {
        tag: 'a[data-type="fileMention"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Render as a span with click handler data - links to attachment section
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'fileMention',
        'data-attachment-id': node.attrs.id,
        'data-attachment-url': node.attrs.url,
        role: 'button',
        tabindex: '0',
        class: 'file-mention inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors',
      }),
      // Add a file icon prefix
      ['span', { class: 'text-xs' }, '📎'],
      ['span', {}, node.attrs.label || 'File'],
    ];
  },

  renderText({ node }) {
    return node.attrs.label || 'File';
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export interface TaskEditorProps {
  content?: TiptapContent | null;
  placeholder?: string;
  editable?: boolean;
  users?: MentionUser[];
  attachments?: FileMentionItem[];
  onSearchUsers?: (query: string) => Promise<MentionUser[]> | MentionUser[];
  onUploadImage?: (file: File) => Promise<string>;
  onChange?: (content: TiptapContent) => void;
  onBlur?: () => void;
  /** Called when a file mention is clicked - receives the attachment id */
  onFileMentionClick?: (attachmentId: string) => void;
  className?: string;
  minHeight?: string;
}

export interface TaskEditorRef {
  getContent: () => TiptapContent | null;
  setContent: (content: TiptapContent | null) => void;
  focus: () => void;
  getEditor: () => Editor | null;
  insertImage: (url: string, alt?: string) => void;
}

export const TaskEditor = forwardRef<TaskEditorRef, TaskEditorProps>(
  function TaskEditor(
    {
      content,
      placeholder = 'Add a description...',
      editable = true,
      users = [],
      attachments = [],
      onSearchUsers,
      onUploadImage,
      onChange,
      onBlur,
      onFileMentionClick,
      className,
      minHeight = '120px',
    },
    ref
  ) {
    const [mentionState, setMentionState] = useState<{
      isOpen: boolean;
      query: string;
      items: MentionUser[];
      selectedIndex: number;
      clientRect: DOMRect | null;
      command: ((props: { id: string; label: string }) => void) | null;
    }>({
      isOpen: false,
      query: '',
      items: [],
      selectedIndex: 0,
      clientRect: null,
      command: null,
    });

    const [fileMentionState, setFileMentionState] = useState<{
      isOpen: boolean;
      query: string;
      items: FileMentionItem[];
      selectedIndex: number;
      clientRect: DOMRect | null;
      command: ((props: { id: string; label: string; url: string }) => void) | null;
    }>({
      isOpen: false,
      query: '',
      items: [],
      selectedIndex: 0,
      clientRect: null,
      command: null,
    });

    const mentionListRef = useRef<HTMLDivElement>(null);
    const fileMentionListRef = useRef<HTMLDivElement>(null);

    // Refs to track current state for use in closures
    const mentionStateRef = useRef(mentionState);
    const fileMentionStateRef = useRef(fileMentionState);
    mentionStateRef.current = mentionState;
    fileMentionStateRef.current = fileMentionState;

    // Refs to hold current values for use in closures
    const usersRef = useRef(users);
    const attachmentsRef = useRef(attachments);
    usersRef.current = users;
    attachmentsRef.current = attachments;

    // Create suggestion configs with refs to avoid stale closures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userSuggestion = useMemo((): any => ({
      items: async ({ query }: { query: string }) => {
        if (onSearchUsers) {
          return onSearchUsers(query);
        }
        const lowerQuery = query.toLowerCase();
        return usersRef.current
          .filter((user) => {
            if (!lowerQuery) return true;
            const name = user.name?.toLowerCase() ?? '';
            const email = user.email.toLowerCase();
            if (name.includes(lowerQuery) || email.includes(lowerQuery)) return true;
            // Match initials (e.g., "aj" matches "Adam Johnson")
            const initials = name.split(/\s+/).map((w) => w[0]).join('');
            if (initials.includes(lowerQuery)) return true;
            return false;
          })
          .slice(0, 5);
      },
      command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: { id: string; label: string } }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'mention',
              attrs: {
                id: props.id,
                label: props.label,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
      },
      render: () => ({
        onStart: (props: { query: string; items: unknown[]; clientRect?: (() => DOMRect | null) | null; command: (props: { id: string; label: string }) => void }) => {
          setMentionState({
            isOpen: true,
            query: props.query,
            items: props.items as MentionUser[],
            selectedIndex: 0,
            clientRect: props.clientRect?.() ?? null,
            command: props.command,
          });
        },
        onUpdate: (props: { query: string; items: unknown[]; clientRect?: (() => DOMRect | null) | null; command: (props: { id: string; label: string }) => void }) => {
          setMentionState((prev) => ({
            ...prev,
            query: props.query,
            items: props.items as MentionUser[],
            clientRect: props.clientRect?.() ?? null,
            command: props.command,
          }));
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            setMentionState((prev) => ({ ...prev, isOpen: false }));
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            setMentionState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % Math.max(prev.items.length, 1),
            }));
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            setMentionState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % Math.max(prev.items.length, 1),
            }));
            return true;
          }
          if (props.event.key === 'Enter') {
            const currentState = mentionStateRef.current;
            const selectedUser = currentState.items[currentState.selectedIndex];
            if (selectedUser && currentState.command) {
              currentState.command({
                id: selectedUser.id,
                label: selectedUser.name || selectedUser.email,
              });
              return true;
            }
          }
          return false;
        },
        onExit: () => {
          setMentionState((prev) => ({ ...prev, isOpen: false }));
        },
      }),
    }), [onSearchUsers]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileSuggestion = useMemo((): any => ({
      char: '+',
      items: ({ query }: { query: string }) => {
        const lowerQuery = query.toLowerCase();
        return attachmentsRef.current
          .filter((file) => file.filename.toLowerCase().includes(lowerQuery))
          .slice(0, 5);
      },
      command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: { id: string; label: string; url: string } }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'fileMention',
              attrs: {
                id: props.id,
                label: props.label,
                url: props.url,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
      },
      render: () => ({
        onStart: (props: { query: string; items: unknown[]; clientRect?: (() => DOMRect | null) | null; command: (props: { id: string; label: string; url: string }) => void }) => {
          setFileMentionState({
            isOpen: true,
            query: props.query,
            items: props.items as FileMentionItem[],
            selectedIndex: 0,
            clientRect: props.clientRect?.() ?? null,
            command: props.command,
          });
        },
        onUpdate: (props: { query: string; items: unknown[]; clientRect?: (() => DOMRect | null) | null; command: (props: { id: string; label: string; url: string }) => void }) => {
          setFileMentionState((prev) => ({
            ...prev,
            query: props.query,
            items: props.items as FileMentionItem[],
            clientRect: props.clientRect?.() ?? null,
            command: props.command,
          }));
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            setFileMentionState((prev) => ({ ...prev, isOpen: false }));
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            setFileMentionState((prev) => ({
              ...prev,
              selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1),
            }));
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            setFileMentionState((prev) => ({
              ...prev,
              selectedIndex: Math.max(prev.selectedIndex - 1, 0),
            }));
            return true;
          }
          if (props.event.key === 'Enter') {
            const currentState = fileMentionStateRef.current;
            const selectedFile = currentState.items[currentState.selectedIndex];
            if (selectedFile && currentState.command) {
              currentState.command({
                id: selectedFile.id,
                label: selectedFile.filename,
                url: selectedFile.url,
              });
              return true;
            }
          }
          return false;
        },
        onExit: () => {
          setFileMentionState((prev) => ({ ...prev, isOpen: false }));
        },
      }),
    }), []);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          bulletList: {
            keepMarks: true,
            keepAttributes: false,
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false,
          },
        }),
        CustomLink.configure({
          openOnClick: true,
          autolink: true,
          defaultProtocol: 'https',
          linkOnPaste: true,
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
        UserMention.configure({
          suggestion: userSuggestion,
        }),
        FileMention.configure({
          suggestion: fileSuggestion,
        }),
        Image.configure({
          HTMLAttributes: {
            class: 'rounded-md max-w-full h-auto',
          },
          allowBase64: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
      ],
      content: content ?? undefined,
      editable,
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm dark:prose-invert max-w-none',
            'focus:outline-none',
            'min-h-[var(--editor-min-height)]',
            '[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
            '[&_.is-editor-empty:first-child]:before:text-muted-foreground',
            '[&_.is-editor-empty:first-child]:before:float-left',
            '[&_.is-editor-empty:first-child]:before:h-0',
            '[&_.is-editor-empty:first-child]:before:pointer-events-none'
          ),
          style: `--editor-min-height: ${minHeight}`,
        },
        // Handle image paste
        handlePaste: (view, event) => {
          const items = event.clipboardData?.items;
          if (!items || !onUploadImage) return false;

          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                onUploadImage(file).then((url) => {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src: url })
                    )
                  );
                });
                return true;
              }
            }
          }
          return false;
        },
        // Handle image drop
        handleDrop: (view, event) => {
          const files = event.dataTransfer?.files;
          if (!files || files.length === 0 || !onUploadImage) return false;

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              
              onUploadImage(file).then((url) => {
                const node = view.state.schema.nodes.image.create({ src: url });
                const transaction = view.state.tr.insert(coordinates?.pos ?? view.state.selection.from, node);
                view.dispatch(transaction);
              });
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON() as TiptapContent;
        onChange?.(json);
      },
      onBlur: () => {
        onBlur?.();
      },
    });

    // Update editor content when prop changes
    useEffect(() => {
      if (editor && content && !editor.isFocused) {
        const currentContent = JSON.stringify(editor.getJSON());
        const newContent = JSON.stringify(content);
        if (currentContent !== newContent) {
          editor.commands.setContent(content);
        }
      }
    }, [editor, content]);

    // Update editable state
    useEffect(() => {
      if (editor) {
        editor.setEditable(editable);
      }
    }, [editor, editable]);

    const handleSelectMention = useCallback(
      (user: MentionUser) => {
        if (!editor) return;
        
        // Get the current mention range from the state
        const state = mentionStateRef.current;
        
        // Delete the trigger character and query, then insert the mention
        editor
          .chain()
          .focus()
          .deleteRange({ from: editor.state.selection.from - (state.query.length + 1), to: editor.state.selection.from })
          .insertContent([
            {
              type: 'mention',
              attrs: {
                id: user.id,
                label: user.name || user.email,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
        
        // Close the suggestion popup
        setMentionState((prev) => ({ ...prev, isOpen: false }));
      },
      [editor]
    );

    const handleSelectFileMention = useCallback(
      (file: FileMentionItem) => {
        if (!editor) return;
        
        // Get the current mention range from the state
        const state = fileMentionStateRef.current;
        
        // Delete the trigger character and query, then insert the mention
        editor
          .chain()
          .focus()
          .deleteRange({ from: editor.state.selection.from - (state.query.length + 1), to: editor.state.selection.from })
          .insertContent([
            {
              type: 'fileMention',
              attrs: {
                id: file.id,
                label: file.filename,
                url: file.url,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
        
        // Close the suggestion popup
        setFileMentionState((prev) => ({ ...prev, isOpen: false }));
      },
      [editor]
    );

    // Handle clicks on file mentions to scroll to attachments section
    useEffect(() => {
      if (!editor || !onFileMentionClick) return;

      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const fileMention = target.closest('[data-type="fileMention"]');
        if (fileMention) {
          event.preventDefault();
          const attachmentId = fileMention.getAttribute('data-attachment-id');
          if (attachmentId) {
            onFileMentionClick(attachmentId);
          }
        }
      };

      const editorElement = editor.view.dom;
      editorElement.addEventListener('click', handleClick);

      return () => {
        editorElement.removeEventListener('click', handleClick);
      };
    }, [editor, onFileMentionClick]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (!editor) return null;
          return editor.getJSON() as TiptapContent;
        },
        setContent: (newContent: TiptapContent | null) => {
          if (editor) {
            editor.commands.setContent(newContent ?? { type: 'doc', content: [] });
          }
        },
        focus: () => {
          editor?.commands.focus();
        },
        getEditor: () => editor,
        insertImage: (url: string, alt?: string) => {
          if (editor) {
            editor.chain().focus().setImage({ src: url, alt }).run();
          }
        },
      }),
      [editor]
    );

    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'rounded-md border border-input bg-transparent',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            !editable && 'bg-muted/50'
          )}
        >
          <EditorContent
            editor={editor}
            className="px-3 py-2"
          />
        </div>

        {/* Mention suggestions popup */}
        {mentionState.isOpen && mentionState.clientRect && (
          <MentionList
            ref={mentionListRef}
            items={mentionState.items}
            selectedIndex={mentionState.selectedIndex}
            onSelect={handleSelectMention}
            style={{
              position: 'fixed',
              left: mentionState.clientRect.left,
              top: mentionState.clientRect.bottom + 8,
            }}
          />
        )}

        {/* File mention suggestions popup */}
        {fileMentionState.isOpen && fileMentionState.clientRect && (
          <FileMentionList
            ref={fileMentionListRef}
            items={fileMentionState.items}
            selectedIndex={fileMentionState.selectedIndex}
            onSelect={handleSelectFileMention}
            style={{
              position: 'fixed',
              left: fileMentionState.clientRect.left,
              top: fileMentionState.clientRect.bottom + 8,
            }}
          />
        )}
      </div>
    );
  }
);
