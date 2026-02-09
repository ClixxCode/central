import { describe, it, expect } from 'vitest';
import {
  createClientSchema,
  updateClientSchema,
  generateSlug,
} from '@/lib/validations/client';
import {
  createBoardSchema,
  updateBoardSchema,
  addBoardAccessSchema,
  statusOptionSchema,
  sectionOptionSchema,
} from '@/lib/validations/board';

describe('Client Validations', () => {
  describe('createClientSchema', () => {
    it('validates valid client data', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme Corporation',
        slug: 'acme',
        color: '#3B82F6',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Acme Corporation');
        expect(result.data.slug).toBe('acme');
        expect(result.data.color).toBe('#3B82F6');
      }
    });

    it('accepts client without color', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme Corporation',
        slug: 'acme',
      });

      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createClientSchema.safeParse({
        name: '',
        slug: 'acme',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Name is required');
      }
    });

    it('rejects empty slug', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme',
        slug: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Slug is required');
      }
    });

    it('rejects slug with uppercase letters', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme',
        slug: 'Acme',
      });

      expect(result.success).toBe(false);
    });

    it('rejects slug with spaces', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme',
        slug: 'acme corp',
      });

      expect(result.success).toBe(false);
    });

    it('accepts slug with hyphens', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme Corporation',
        slug: 'acme-corporation',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid color format', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme',
        slug: 'acme',
        color: 'blue',
      });

      expect(result.success).toBe(false);
    });

    it('accepts valid hex color', () => {
      const result = createClientSchema.safeParse({
        name: 'Acme',
        slug: 'acme',
        color: '#FF5733',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateClientSchema', () => {
    it('allows partial updates', () => {
      const result = updateClientSchema.safeParse({
        name: 'New Name',
      });

      expect(result.success).toBe(true);
    });

    it('allows empty object', () => {
      const result = updateClientSchema.safeParse({});

      expect(result.success).toBe(true);
    });
  });

  describe('generateSlug', () => {
    it('converts name to lowercase slug', () => {
      expect(generateSlug('Acme Corporation')).toBe('acme-corporation');
    });

    it('removes special characters', () => {
      expect(generateSlug("Acme's & Co.")).toBe('acme-s-co');
    });

    it('handles multiple spaces', () => {
      expect(generateSlug('Acme   Corp')).toBe('acme-corp');
    });

    it('trims leading and trailing hyphens', () => {
      expect(generateSlug('  Acme  ')).toBe('acme');
    });
  });
});

describe('Board Validations', () => {
  describe('createBoardSchema', () => {
    it('validates valid board data', () => {
      const result = createBoardSchema.safeParse({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Main Board',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid clientId', () => {
      const result = createBoardSchema.safeParse({
        clientId: 'not-a-uuid',
        name: 'Main Board',
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createBoardSchema.safeParse({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('accepts custom status options', () => {
      const result = createBoardSchema.safeParse({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Main Board',
        statusOptions: [
          { id: 'new', label: 'New', color: '#3B82F6', position: 0 },
          { id: 'done', label: 'Done', color: '#10B981', position: 1 },
        ],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateBoardSchema', () => {
    it('allows updating just name', () => {
      const result = updateBoardSchema.safeParse({
        name: 'Updated Board Name',
      });

      expect(result.success).toBe(true);
    });

    it('allows updating status options', () => {
      const result = updateBoardSchema.safeParse({
        statusOptions: [
          { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
        ],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('statusOptionSchema', () => {
    it('validates valid status option', () => {
      const result = statusOptionSchema.safeParse({
        id: 'todo',
        label: 'To Do',
        color: '#6B7280',
        position: 0,
      });

      expect(result.success).toBe(true);
    });

    it('rejects empty label', () => {
      const result = statusOptionSchema.safeParse({
        id: 'todo',
        label: '',
        color: '#6B7280',
        position: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid color', () => {
      const result = statusOptionSchema.safeParse({
        id: 'todo',
        label: 'To Do',
        color: 'gray',
        position: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative position', () => {
      const result = statusOptionSchema.safeParse({
        id: 'todo',
        label: 'To Do',
        color: '#6B7280',
        position: -1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sectionOptionSchema', () => {
    it('validates valid section option', () => {
      const result = sectionOptionSchema.safeParse({
        id: 'marketing',
        label: 'Marketing',
        color: '#EC4899',
        position: 0,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('addBoardAccessSchema', () => {
    it('validates user access', () => {
      const result = addBoardAccessSchema.safeParse({
        boardId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        accessLevel: 'full',
      });

      expect(result.success).toBe(true);
    });

    it('validates team access', () => {
      const result = addBoardAccessSchema.safeParse({
        boardId: '550e8400-e29b-41d4-a716-446655440000',
        teamId: '550e8400-e29b-41d4-a716-446655440002',
        accessLevel: 'assigned_only',
      });

      expect(result.success).toBe(true);
    });

    it('rejects when both userId and teamId are provided', () => {
      const result = addBoardAccessSchema.safeParse({
        boardId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        teamId: '550e8400-e29b-41d4-a716-446655440002',
        accessLevel: 'full',
      });

      expect(result.success).toBe(false);
    });

    it('rejects when neither userId nor teamId is provided', () => {
      const result = addBoardAccessSchema.safeParse({
        boardId: '550e8400-e29b-41d4-a716-446655440000',
        accessLevel: 'full',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid access level', () => {
      const result = addBoardAccessSchema.safeParse({
        boardId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        accessLevel: 'admin',
      });

      expect(result.success).toBe(false);
    });
  });
});
