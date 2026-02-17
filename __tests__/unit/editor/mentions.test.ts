import { describe, it, expect } from 'vitest';
import {
  extractMentionedUserIds,
  extractNewMentions,
  hasMentions,
  getPlainText,
  isContentEmpty,
  createEmptyContent,
  createSimpleContent,
} from '@/lib/editor/mentions';
import type { TiptapContent } from '@/lib/db/schema/tasks';

describe('Mention extraction utilities', () => {
  describe('extractMentionedUserIds', () => {
    it('returns empty array for null content', () => {
      expect(extractMentionedUserIds(null)).toEqual([]);
    });

    it('returns empty array for undefined content', () => {
      expect(extractMentionedUserIds(undefined)).toEqual([]);
    });

    it('returns empty array for empty document', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [],
      };
      expect(extractMentionedUserIds(content)).toEqual([]);
    });

    it('returns empty array for document with no mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello world' },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual([]);
    });

    it('extracts a single mention', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              {
                type: 'mention',
                attrs: { id: 'user-123', label: 'John Doe' },
              },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual(['user-123']);
    });

    it('extracts multiple mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'Alice' },
              },
              { type: 'text', text: ' and ' },
              {
                type: 'mention',
                attrs: { id: 'user-2', label: 'Bob' },
              },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual(['user-1', 'user-2']);
    });

    it('returns unique mentions only', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'Alice' },
              },
              { type: 'text', text: ' mentioned again ' },
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'Alice' },
              },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual(['user-1']);
    });

    it('extracts mentions from nested content', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'mention',
                        attrs: { id: 'user-nested', label: 'Nested User' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual(['user-nested']);
    });

    it('extracts mentions from blockquotes', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'mention',
                    attrs: { id: 'user-quoted', label: 'Quoted User' },
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(extractMentionedUserIds(content)).toEqual(['user-quoted']);
    });
  });

  describe('hasMentions', () => {
    it('returns false for null content', () => {
      expect(hasMentions(null)).toBe(false);
    });

    it('returns false for content without mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No mentions here' }],
          },
        ],
      };
      expect(hasMentions(content)).toBe(false);
    });

    it('returns true for content with mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User' },
              },
            ],
          },
        ],
      };
      expect(hasMentions(content)).toBe(true);
    });
  });

  describe('extractNewMentions', () => {
    it('returns all mentions when previous content is null', () => {
      const newContent: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User 1' },
              },
            ],
          },
        ],
      };
      expect(extractNewMentions(newContent, null)).toEqual(['user-1']);
    });

    it('returns only new mentions', () => {
      const previousContent: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User 1' },
              },
            ],
          },
        ],
      };

      const newContent: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User 1' },
              },
              {
                type: 'mention',
                attrs: { id: 'user-2', label: 'User 2' },
              },
            ],
          },
        ],
      };

      expect(extractNewMentions(newContent, previousContent)).toEqual(['user-2']);
    });

    it('returns empty array when no new mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User 1' },
              },
            ],
          },
        ],
      };

      expect(extractNewMentions(content, content)).toEqual([]);
    });
  });

  describe('getPlainText', () => {
    it('returns empty string for null content', () => {
      expect(getPlainText(null)).toBe('');
    });

    it('returns empty string for empty document', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [],
      };
      expect(getPlainText(content)).toBe('');
    });

    it('extracts plain text from paragraphs', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      };
      expect(getPlainText(content)).toBe('Hello world');
    });

    it('includes mention labels with @ prefix', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'John' },
              },
            ],
          },
        ],
      };
      expect(getPlainText(content)).toBe('Hello @John');
    });

    it('adds newlines between paragraphs', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }],
          },
        ],
      };
      expect(getPlainText(content)).toContain('First paragraph');
      expect(getPlainText(content)).toContain('Second paragraph');
    });
  });

  describe('isContentEmpty', () => {
    it('returns true for null content', () => {
      expect(isContentEmpty(null)).toBe(true);
    });

    it('returns true for empty document', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [],
      };
      expect(isContentEmpty(content)).toBe(true);
    });

    it('returns true for document with only whitespace', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '   ' }],
          },
        ],
      };
      expect(isContentEmpty(content)).toBe(true);
    });

    it('returns false for document with text', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };
      expect(isContentEmpty(content)).toBe(false);
    });

    it('returns false for document with only mentions', () => {
      const content: TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mention',
                attrs: { id: 'user-1', label: 'User' },
              },
            ],
          },
        ],
      };
      expect(isContentEmpty(content)).toBe(false);
    });
  });

  describe('createEmptyContent', () => {
    it('creates a valid empty document', () => {
      const content = createEmptyContent();
      expect(content.type).toBe('doc');
      expect(content.content).toEqual([]);
    });
  });

  describe('createSimpleContent', () => {
    it('creates a document with text', () => {
      const content = createSimpleContent('Hello world');
      expect(content.type).toBe('doc');
      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('paragraph');
      expect(content.content[0].content?.[0].text).toBe('Hello world');
    });

    it('trims whitespace from text', () => {
      const content = createSimpleContent('  Hello world  ');
      expect(content.content[0].content?.[0].text).toBe('Hello world');
    });

    it('returns empty document for empty string', () => {
      const content = createSimpleContent('');
      expect(content.content).toEqual([]);
    });

    it('returns empty document for whitespace-only string', () => {
      const content = createSimpleContent('   ');
      expect(content.content).toEqual([]);
    });
  });
});
