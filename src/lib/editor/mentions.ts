import type { TiptapContent, TiptapNode } from '@/lib/db/schema/tasks';

/**
 * Extract all mentioned user IDs from Tiptap content
 * This function recursively walks the Tiptap document tree
 * to find all mention nodes and extract their user IDs.
 *
 * @param content - The Tiptap document content
 * @returns Array of unique user IDs that were mentioned
 */
export function extractMentionedUserIds(content: TiptapContent | null | undefined): string[] {
  if (!content?.content) {
    return [];
  }

  const mentionIds = new Set<string>();

  function walkNodes(nodes: TiptapNode[]): void {
    for (const node of nodes) {
      // Check if this is a mention node
      if (node.type === 'mention' && node.attrs?.id) {
        mentionIds.add(String(node.attrs.id));
      }

      // Recursively check child nodes
      if (node.content) {
        walkNodes(node.content);
      }
    }
  }

  walkNodes(content.content);

  return Array.from(mentionIds);
}

/**
 * Check if content contains any mentions
 */
export function hasMentions(content: TiptapContent | null | undefined): boolean {
  return extractMentionedUserIds(content).length > 0;
}

/**
 * Extract mentioned user IDs that are new compared to previous content
 * Useful for determining who should be notified when content is updated
 *
 * @param newContent - The updated content
 * @param previousContent - The previous content (optional)
 * @returns Array of user IDs that are newly mentioned
 */
export function extractNewMentions(
  newContent: TiptapContent | null | undefined,
  previousContent: TiptapContent | null | undefined
): string[] {
  const newMentions = extractMentionedUserIds(newContent);
  const previousMentions = new Set(extractMentionedUserIds(previousContent));

  return newMentions.filter((id) => !previousMentions.has(id));
}

/**
 * Get plain text content from Tiptap document
 * Useful for generating previews or search text
 *
 * @param content - The Tiptap document content
 * @returns Plain text string
 */
export function getPlainText(content: TiptapContent | null | undefined): string {
  if (!content?.content) {
    return '';
  }

  const textParts: string[] = [];

  function walkNodes(nodes: TiptapNode[]): void {
    for (const node of nodes) {
      // Handle text nodes
      if (node.text) {
        textParts.push(node.text);
      }

      // Handle mention nodes - use label attribute
      if (node.type === 'mention' && node.attrs?.label) {
        textParts.push(`@${node.attrs.label}`);
      }

      // Handle block-level elements with newlines
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listItem'
      ) {
        if (textParts.length > 0 && !textParts[textParts.length - 1].endsWith('\n')) {
          textParts.push('\n');
        }
      }

      // Recursively process child nodes
      if (node.content) {
        walkNodes(node.content);
      }
    }
  }

  walkNodes(content.content);

  return textParts.join('').trim();
}

/**
 * Check if content is empty (no meaningful text)
 */
export function isContentEmpty(content: TiptapContent | null | undefined): boolean {
  if (!content?.content) {
    return true;
  }

  const plainText = getPlainText(content);
  return plainText.length === 0;
}

/**
 * Create an empty Tiptap document
 */
export function createEmptyContent(): TiptapContent {
  return {
    type: 'doc',
    content: [],
  };
}

/**
 * Create a simple paragraph document with text
 */
export function createSimpleContent(text: string): TiptapContent {
  if (!text.trim()) {
    return createEmptyContent();
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: text.trim(),
          },
        ],
      },
    ],
  };
}
