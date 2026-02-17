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
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
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
import { LinkBubbleMenu } from './LinkBubbleMenu';

// Custom Link extension — adds href as title attribute for URL tooltip on hover
const CustomLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    if (attrs.href) {
      attrs.title = attrs.href;
    }
    return ['a', attrs, 0];
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
      ['span', {}, node.attrs.label || 'File'],
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-type', 'fileMention');
      dom.setAttribute('data-attachment-id', node.attrs.id || '');
      dom.setAttribute('data-attachment-url', node.attrs.url || '');
      dom.setAttribute('role', 'button');
      dom.setAttribute('tabindex', '0');
      dom.className = 'file-mention inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors';
      dom.contentEditable = 'false';

      // SVG paperclip icon
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '14');
      icon.setAttribute('height', '14');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.style.flexShrink = '0';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48');
      icon.appendChild(path);
      dom.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = node.attrs.label || 'File';
      dom.appendChild(label);

      return { dom };
    };
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

// Custom Front Conversation card — block node for linked Front conversations
const FrontConversation = Node.create({
  name: 'frontConversation',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    const attr = (name: string, dataAttr?: string) => ({
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute(dataAttr || `data-${name}`),
      renderHTML: (attributes: Record<string, string | null>) => {
        if (!attributes[name]) return {};
        return { [dataAttr || `data-${name}`]: attributes[name] };
      },
    });
    return {
      url: attr('url', 'data-url'),
      subject: attr('subject', 'data-subject'),
      sender: attr('sender', 'data-sender'),
      senderEmail: attr('senderEmail', 'data-sender-email'),
      recipient: attr('recipient', 'data-recipient'),
      date: attr('date', 'data-date'),
      body: attr('body', 'data-body'),
      preview: attr('preview', 'data-preview'), // legacy compat
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="frontConversation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'frontConversation',
        class: 'front-conversation-card',
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      // All styles inline to avoid CSS delivery / layer / purge issues
      const dom = document.createElement('div');
      dom.setAttribute('data-type', 'frontConversation');
      dom.contentEditable = 'false';
      Object.assign(dom.style, {
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        margin: '0.75rem 0',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--card)',
      });
      dom.addEventListener('mouseenter', () => { dom.style.background = 'var(--accent)'; });
      dom.addEventListener('mouseleave', () => { dom.style.background = 'var(--card)'; });

      const url = node.attrs.url || '';
      const subject = node.attrs.subject || '';
      const sender = node.attrs.sender;
      const senderEmail = node.attrs.senderEmail;
      const recipient = node.attrs.recipient;
      const date = node.attrs.date;
      const body = node.attrs.body || node.attrs.preview || '';

      if (url) {
        dom.addEventListener('click', () => {
          window.open(url, '_blank', 'noopener,noreferrer');
        });
      }

      // ── Header row: avatar + sender/to + date ──
      const header = document.createElement('div');
      Object.assign(header.style, {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem 1rem 0',
      });

      // Avatar
      const avatar = document.createElement('div');
      Object.assign(avatar.style, {
        width: '2rem',
        height: '2rem',
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        fontWeight: '500',
        flexShrink: '0',
        background: 'var(--muted)',
        color: 'var(--muted-foreground)',
      });
      const cleanName = (sender || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
      const initials = cleanName
        ? cleanName.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        : senderEmail ? senderEmail[0].toUpperCase() : '?';
      avatar.textContent = initials;
      header.appendChild(avatar);

      // Meta column
      const meta = document.createElement('div');
      Object.assign(meta.style, { flex: '1', minWidth: '0' });

      const senderLine = document.createElement('div');
      Object.assign(senderLine.style, { fontSize: '0.875rem', lineHeight: '1.375' });
      if (sender) {
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = '600';
        nameSpan.textContent = sender;
        senderLine.appendChild(nameSpan);
      }
      if (senderEmail) {
        const emailSpan = document.createElement('span');
        Object.assign(emailSpan.style, { color: 'var(--muted-foreground)', fontWeight: '400' });
        emailSpan.textContent = sender ? ` <${senderEmail}>` : senderEmail;
        senderLine.appendChild(emailSpan);
      }
      if (!sender && !senderEmail && subject) {
        const subjectSpan = document.createElement('span');
        subjectSpan.style.fontWeight = '600';
        subjectSpan.textContent = subject;
        senderLine.appendChild(subjectSpan);
      }
      meta.appendChild(senderLine);

      if (recipient) {
        const toLine = document.createElement('div');
        Object.assign(toLine.style, {
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          marginTop: '0.125rem',
        });
        toLine.textContent = recipient;
        meta.appendChild(toLine);
      }
      header.appendChild(meta);

      // Date
      if (date) {
        const dateDiv = document.createElement('div');
        Object.assign(dateDiv.style, {
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          flexShrink: '0',
          paddingTop: '0.125rem',
        });
        dateDiv.textContent = date;
        header.appendChild(dateDiv);
      }

      dom.appendChild(header);

      // ── Subject ──
      if (subject && (sender || senderEmail)) {
        const subjectDiv = document.createElement('div');
        Object.assign(subjectDiv.style, {
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          padding: '0.25rem 1rem 0',
        });
        subjectDiv.textContent = subject;
        dom.appendChild(subjectDiv);
      }

      // ── Body ──
      if (body) {
        const bodyDiv = document.createElement('div');
        Object.assign(bodyDiv.style, {
          fontSize: '0.875rem',
          padding: '0.5rem 1rem 0.75rem',
          whiteSpace: 'pre-line',
          display: '-webkit-box',
          WebkitLineClamp: '4',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        });
        bodyDiv.textContent = body;
        dom.appendChild(bodyDiv);
      }

      return { dom };
    };
  },

  renderText({ node }) {
    return node.attrs.subject || 'Front Conversation';
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
  onUploadAttachment?: () => Promise<FileMentionItem | null>;
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
  insertFileMention: (item: FileMentionItem) => void;
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
      onUploadAttachment,
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
    const editorInstanceRef = useRef<Editor | null>(null);

    // Refs to track current state for use in closures
    const mentionStateRef = useRef(mentionState);
    const fileMentionStateRef = useRef(fileMentionState);
    mentionStateRef.current = mentionState;
    fileMentionStateRef.current = fileMentionState;

    // Refs to hold current values for use in closures
    const usersRef = useRef(users);
    const attachmentsRef = useRef(attachments);
    const onUploadAttachmentRef = useRef(onUploadAttachment);
    usersRef.current = users;
    attachmentsRef.current = attachments;
    onUploadAttachmentRef.current = onUploadAttachment;

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

    // Handle upload from the file suggestion popup
    const handleUploadFromSuggestion = useCallback(async () => {
      const currentState = fileMentionStateRef.current;
      const uploadFn = onUploadAttachmentRef.current;
      const editor = editorInstanceRef.current;
      if (!uploadFn || !editor) return;

      // Delete the +query trigger text from the editor
      const queryLen = currentState.query.length + 1; // +1 for the '+' char
      const from = editor.state.selection.from - queryLen;
      const to = editor.state.selection.from;
      editor.chain().focus().deleteRange({ from, to }).run();

      // Close popup
      setFileMentionState((prev) => ({ ...prev, isOpen: false }));

      const item = await uploadFn();
      if (item) {
        // Insert the file mention at current cursor position
        editorInstanceRef.current
          ?.chain()
          .focus()
          .insertContent([
            {
              type: 'fileMention',
              attrs: {
                id: item.id,
                label: item.filename,
                url: item.url,
              },
            },
            { type: 'text', text: ' ' },
          ])
          .run();
      }
    }, []);

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
          const hasUploadRow = !!onUploadAttachmentRef.current;
          if (props.event.key === 'ArrowDown') {
            setFileMentionState((prev) => {
              const maxIndex = hasUploadRow ? prev.items.length : prev.items.length - 1;
              return {
                ...prev,
                selectedIndex: Math.min(prev.selectedIndex + 1, maxIndex),
              };
            });
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
            // Upload row is selected (index === items.length)
            if (hasUploadRow && currentState.selectedIndex === currentState.items.length) {
              handleUploadFromSuggestion();
              return true;
            }
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
          openOnClick: false,
          enableClickSelection: true,
          autolink: true,
          defaultProtocol: 'https',
          linkOnPaste: true,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'text-primary underline underline-offset-2 hover:text-primary/80',
          },
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
        Table.configure({
          resizable: true,
          HTMLAttributes: { class: 'tiptap-table' },
        }),
        TableRow,
        TableHeader,
        TableCell,
        FrontConversation,
      ],
      content: content ?? undefined,
      editable: true, // Always start editable so table resize plugin registers; useEffect below syncs actual state
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

    // Keep editor ref in sync for use in closures
    editorInstanceRef.current = editor;

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

    // Handle Cmd/Ctrl+click on links to open them directly in edit mode
    useEffect(() => {
      if (!editor || !editable) return;

      const handleClick = (event: MouseEvent) => {
        if (!(event.metaKey || event.ctrlKey)) return;
        const link = (event.target as HTMLElement).closest('a');
        if (link?.href) {
          event.preventDefault();
          window.open(link.href, '_blank', 'noopener,noreferrer');
        }
      };

      const editorElement = editor.view.dom;
      editorElement.addEventListener('click', handleClick);

      return () => {
        editorElement.removeEventListener('click', handleClick);
      };
    }, [editor, editable]);

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
        insertFileMention: (item: FileMentionItem) => {
          if (editor) {
            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: 'fileMention',
                  attrs: {
                    id: item.id,
                    label: item.filename,
                    url: item.url,
                  },
                },
                { type: 'text', text: ' ' },
              ])
              .run();
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
          {editor && editable && <LinkBubbleMenu editor={editor} />}
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
            onUploadClick={onUploadAttachment ? handleUploadFromSuggestion : undefined}
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
