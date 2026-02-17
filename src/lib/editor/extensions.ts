import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { AnyExtension } from '@tiptap/core';

// User type for mentions
export interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

// Mention suggestion configuration
export interface MentionSuggestionOptions {
  users: MentionUser[];
  onSearch?: (query: string) => Promise<MentionUser[]> | MentionUser[];
}

// Create mention suggestion configuration
export function createMentionSuggestion(options: MentionSuggestionOptions) {
  return {
    items: async ({ query }: { query: string }): Promise<MentionUser[]> => {
      if (options.onSearch) {
        return options.onSearch(query);
      }

      const lowerQuery = query.toLowerCase();
      return options.users
        .filter((user) =>
          user.name?.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 5);
    },

    render: () => {
      let component: {
        onKeyDown: (props: SuggestionKeyDownProps) => boolean;
        destroy: () => void;
        updateProps: (props: SuggestionProps<MentionUser>) => void;
      } | null = null;
      let popup: HTMLElement | null = null;

      return {
        onStart: (props: SuggestionProps<MentionUser>) => {
          // Create popup element
          popup = document.createElement('div');
          popup.className = 'mention-suggestions';
          document.body.appendChild(popup);

          // Position near cursor
          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.position = 'absolute';
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 8}px`;
            popup.style.zIndex = '50';
          }

          component = {
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              if (event.key === 'Escape') {
                popup?.remove();
                return true;
              }
              return false;
            },
            destroy: () => {
              popup?.remove();
            },
            updateProps: () => {
              // Update handled by React component
            },
          };
        },

        onUpdate: (props: SuggestionProps<MentionUser>) => {
          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 8}px`;
          }
        },

        onKeyDown: (props: SuggestionKeyDownProps) => {
          return component?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          component?.destroy();
          component = null;
          popup = null;
        },
      };
    },
  };
}

// Get configured extensions for the editor
export function getEditorExtensions(options?: {
  placeholder?: string;
  mentionSuggestion?: ReturnType<typeof createMentionSuggestion>;
}): AnyExtension[] {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      // Disable heading levels 4-6, keep 1-3
      heading: {
        levels: [1, 2, 3],
      },
      // Configure other StarterKit options
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),

    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2 hover:text-primary/80',
      },
    }),

    Placeholder.configure({
      placeholder: options?.placeholder ?? 'Write something...',
      emptyEditorClass: 'is-editor-empty',
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
  ];

  // Add mention extension if suggestion config provided
  if (options?.mentionSuggestion) {
    extensions.push(
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: options.mentionSuggestion,
      })
    );
  }

  return extensions;
}

// Default extensions without mentions (for simple use cases)
export const defaultExtensions = getEditorExtensions({
  placeholder: 'Add a description...',
});
