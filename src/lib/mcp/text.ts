import type { TiptapContent, TiptapNode } from '@/lib/db/schema';

export function textToTiptap(value: string): TiptapContent {
  const content: TiptapNode[] = value
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: paragraph.split('\n').flatMap((line, index) => {
        const nodes: TiptapNode[] = [];
        if (index > 0) nodes.push({ type: 'hardBreak' });
        const pattern = /https?:\/\/[^\s]+/g;
        let cursor = 0;
        for (const match of line.matchAll(pattern)) {
          const start = match.index ?? 0;
          if (start > cursor) nodes.push({ type: 'text', text: line.slice(cursor, start) });
          nodes.push({
            type: 'text',
            text: match[0],
            marks: [{ type: 'link', attrs: { href: match[0], target: '_blank', rel: 'noopener noreferrer' } }],
          });
          cursor = start + match[0].length;
        }
        if (cursor < line.length) nodes.push({ type: 'text', text: line.slice(cursor) });
        return nodes;
      }),
    }));
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

export function tiptapToText(value: TiptapContent | null | undefined): string | null {
  if (!value) return null;
  const walk = (node: TiptapNode): string => {
    if (node.text) return node.text;
    if (node.type === 'hardBreak') return '\n';
    const joined = node.content?.map(walk).join('') ?? '';
    return node.type === 'paragraph' ? `${joined}\n\n` : joined;
  };
  return value.content?.map(walk).join('').trim() || null;
}
