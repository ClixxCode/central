import { describe, it, expect } from 'vitest';
import {
  createRollupBoardSchema,
  updateRollupSourcesSchema,
  updateRollupBoardSchema,
} from '@/lib/validations/rollup';

describe('Rollup Validations', () => {
  const validUUID1 = '550e8400-e29b-41d4-a716-446655440000';
  const validUUID2 = '550e8400-e29b-41d4-a716-446655440001';
  const validUUID3 = '550e8400-e29b-41d4-a716-446655440002';

  describe('createRollupBoardSchema', () => {
    it('validates valid rollup data', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'All Client Tasks',
        sourceBoardIds: [validUUID1, validUUID2],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('All Client Tasks');
        expect(result.data.sourceBoardIds).toHaveLength(2);
      }
    });

    it('accepts single source board', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'Single Source Rollup',
        sourceBoardIds: [validUUID1],
      });

      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createRollupBoardSchema.safeParse({
        name: '',
        sourceBoardIds: [validUUID1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Name is required');
      }
    });

    it('rejects name that is too long', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'A'.repeat(256),
        sourceBoardIds: [validUUID1],
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty source boards array', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'Empty Rollup',
        sourceBoardIds: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one source board');
      }
    });

    it('rejects invalid board IDs', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'Invalid IDs Rollup',
        sourceBoardIds: ['not-a-uuid', 'also-not-a-uuid'],
      });

      expect(result.success).toBe(false);
    });

    it('accepts multiple valid board IDs', () => {
      const result = createRollupBoardSchema.safeParse({
        name: 'Multi-Board Rollup',
        sourceBoardIds: [validUUID1, validUUID2, validUUID3],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sourceBoardIds).toHaveLength(3);
      }
    });
  });

  describe('updateRollupSourcesSchema', () => {
    it('validates valid update data', () => {
      const result = updateRollupSourcesSchema.safeParse({
        rollupBoardId: validUUID1,
        sourceBoardIds: [validUUID2, validUUID3],
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid rollup board ID', () => {
      const result = updateRollupSourcesSchema.safeParse({
        rollupBoardId: 'not-a-uuid',
        sourceBoardIds: [validUUID1],
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty source boards', () => {
      const result = updateRollupSourcesSchema.safeParse({
        rollupBoardId: validUUID1,
        sourceBoardIds: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing rollup board ID', () => {
      const result = updateRollupSourcesSchema.safeParse({
        sourceBoardIds: [validUUID1],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateRollupBoardSchema', () => {
    it('allows updating just name', () => {
      const result = updateRollupBoardSchema.safeParse({
        name: 'Updated Rollup Name',
      });

      expect(result.success).toBe(true);
    });

    it('allows empty object (no changes)', () => {
      const result = updateRollupBoardSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = updateRollupBoardSchema.safeParse({
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('rejects name that is too long', () => {
      const result = updateRollupBoardSchema.safeParse({
        name: 'A'.repeat(256),
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Rollup Task Aggregation Logic', () => {
  // These are logic tests that don't require database access

  describe('Task grouping by status', () => {
    interface MockTask {
      id: string;
      status: string;
      clientName: string | null;
      position: number;
    }

    const groupTasksByStatus = (tasks: MockTask[], statuses: string[]) => {
      const grouped: Record<string, MockTask[]> = {};
      statuses.forEach((status) => {
        grouped[status] = [];
      });
      tasks.forEach((task) => {
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
      // Sort by client, then position
      Object.keys(grouped).forEach((status) => {
        grouped[status].sort((a, b) => {
          const clientA = a.clientName ?? '';
          const clientB = b.clientName ?? '';
          if (clientA !== clientB) {
            return clientA.localeCompare(clientB);
          }
          return a.position - b.position;
        });
      });
      return grouped;
    };

    it('groups tasks by status correctly', () => {
      const tasks: MockTask[] = [
        { id: '1', status: 'todo', clientName: 'Client A', position: 0 },
        { id: '2', status: 'in-progress', clientName: 'Client A', position: 0 },
        { id: '3', status: 'todo', clientName: 'Client B', position: 0 },
      ];
      const statuses = ['todo', 'in-progress', 'done'];

      const grouped = groupTasksByStatus(tasks, statuses);

      expect(grouped['todo']).toHaveLength(2);
      expect(grouped['in-progress']).toHaveLength(1);
      expect(grouped['done']).toHaveLength(0);
    });

    it('sorts tasks by client name within status', () => {
      const tasks: MockTask[] = [
        { id: '1', status: 'todo', clientName: 'Zebra Corp', position: 0 },
        { id: '2', status: 'todo', clientName: 'Acme Inc', position: 0 },
        { id: '3', status: 'todo', clientName: 'Beta LLC', position: 0 },
      ];
      const statuses = ['todo'];

      const grouped = groupTasksByStatus(tasks, statuses);

      expect(grouped['todo'][0].clientName).toBe('Acme Inc');
      expect(grouped['todo'][1].clientName).toBe('Beta LLC');
      expect(grouped['todo'][2].clientName).toBe('Zebra Corp');
    });

    it('sorts tasks by position within same client', () => {
      const tasks: MockTask[] = [
        { id: '1', status: 'todo', clientName: 'Acme', position: 2 },
        { id: '2', status: 'todo', clientName: 'Acme', position: 0 },
        { id: '3', status: 'todo', clientName: 'Acme', position: 1 },
      ];
      const statuses = ['todo'];

      const grouped = groupTasksByStatus(tasks, statuses);

      expect(grouped['todo'][0].id).toBe('2');
      expect(grouped['todo'][1].id).toBe('3');
      expect(grouped['todo'][2].id).toBe('1');
    });

    it('handles empty task list', () => {
      const tasks: MockTask[] = [];
      const statuses = ['todo', 'in-progress', 'done'];

      const grouped = groupTasksByStatus(tasks, statuses);

      expect(grouped['todo']).toHaveLength(0);
      expect(grouped['in-progress']).toHaveLength(0);
      expect(grouped['done']).toHaveLength(0);
    });

    it('handles tasks with null client name', () => {
      const tasks: MockTask[] = [
        { id: '1', status: 'todo', clientName: 'Acme', position: 0 },
        { id: '2', status: 'todo', clientName: null, position: 0 },
      ];
      const statuses = ['todo'];

      const grouped = groupTasksByStatus(tasks, statuses);

      // null client should sort before named clients (empty string < 'Acme')
      expect(grouped['todo'][0].clientName).toBe(null);
      expect(grouped['todo'][1].clientName).toBe('Acme');
    });
  });

  describe('Status options aggregation', () => {
    interface StatusOption {
      id: string;
      label: string;
      color: string;
      position: number;
    }

    const aggregateStatusOptions = (
      optionsByBoard: StatusOption[][]
    ): StatusOption[] => {
      const map = new Map<string, StatusOption>();
      for (const options of optionsByBoard) {
        for (const option of options) {
          if (!map.has(option.id)) {
            map.set(option.id, option);
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => a.position - b.position);
    };

    it('aggregates status options from multiple boards', () => {
      const board1Options: StatusOption[] = [
        { id: 'todo', label: 'To Do', color: '#gray', position: 0 },
        { id: 'done', label: 'Done', color: '#green', position: 1 },
      ];
      const board2Options: StatusOption[] = [
        { id: 'todo', label: 'To Do', color: '#gray', position: 0 },
        { id: 'review', label: 'Review', color: '#yellow', position: 1 },
      ];

      const aggregated = aggregateStatusOptions([board1Options, board2Options]);

      expect(aggregated).toHaveLength(3);
      expect(aggregated.map((s) => s.id)).toContain('todo');
      expect(aggregated.map((s) => s.id)).toContain('done');
      expect(aggregated.map((s) => s.id)).toContain('review');
    });

    it('deduplicates status options by ID', () => {
      const board1Options: StatusOption[] = [
        { id: 'todo', label: 'To Do', color: '#gray', position: 0 },
      ];
      const board2Options: StatusOption[] = [
        { id: 'todo', label: 'To Do Updated', color: '#blue', position: 0 },
      ];

      const aggregated = aggregateStatusOptions([board1Options, board2Options]);

      // Should only have one 'todo', keeping the first one found
      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].label).toBe('To Do');
    });

    it('handles empty options arrays', () => {
      const aggregated = aggregateStatusOptions([[], []]);

      expect(aggregated).toHaveLength(0);
    });

    it('sorts aggregated options by position', () => {
      const board1Options: StatusOption[] = [
        { id: 'c', label: 'Third', color: '#red', position: 2 },
        { id: 'a', label: 'First', color: '#green', position: 0 },
      ];
      const board2Options: StatusOption[] = [
        { id: 'b', label: 'Second', color: '#blue', position: 1 },
      ];

      const aggregated = aggregateStatusOptions([board1Options, board2Options]);

      expect(aggregated[0].id).toBe('a');
      expect(aggregated[1].id).toBe('b');
      expect(aggregated[2].id).toBe('c');
    });
  });

  describe('Board access filtering', () => {
    interface AccessLevel {
      boardId: string;
      level: 'full' | 'assigned_only';
    }

    interface MockTask {
      id: string;
      boardId: string;
      assigneeIds: string[];
    }

    const filterTasksByAccess = (
      tasks: MockTask[],
      accessLevels: Map<string, AccessLevel['level']>,
      userId: string
    ): MockTask[] => {
      return tasks.filter((task) => {
        const level = accessLevels.get(task.boardId);
        if (level === 'full') return true;
        if (level === 'assigned_only') {
          return task.assigneeIds.includes(userId);
        }
        return false;
      });
    };

    it('shows all tasks for full access boards', () => {
      const tasks: MockTask[] = [
        { id: '1', boardId: 'board1', assigneeIds: ['user2'] },
        { id: '2', boardId: 'board1', assigneeIds: ['user3'] },
      ];
      const accessLevels = new Map([['board1', 'full' as const]]);

      const filtered = filterTasksByAccess(tasks, accessLevels, 'user1');

      expect(filtered).toHaveLength(2);
    });

    it('only shows assigned tasks for assigned_only access', () => {
      const tasks: MockTask[] = [
        { id: '1', boardId: 'board1', assigneeIds: ['user1'] },
        { id: '2', boardId: 'board1', assigneeIds: ['user2'] },
        { id: '3', boardId: 'board1', assigneeIds: ['user1', 'user2'] },
      ];
      const accessLevels = new Map([['board1', 'assigned_only' as const]]);

      const filtered = filterTasksByAccess(tasks, accessLevels, 'user1');

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toContain('1');
      expect(filtered.map((t) => t.id)).toContain('3');
    });

    it('handles mixed access levels across boards', () => {
      const tasks: MockTask[] = [
        { id: '1', boardId: 'board1', assigneeIds: ['user2'] },
        { id: '2', boardId: 'board2', assigneeIds: ['user1'] },
        { id: '3', boardId: 'board2', assigneeIds: ['user2'] },
      ];
      const accessLevels = new Map([
        ['board1', 'full' as const],
        ['board2', 'assigned_only' as const],
      ]);

      const filtered = filterTasksByAccess(tasks, accessLevels, 'user1');

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toContain('1'); // full access
      expect(filtered.map((t) => t.id)).toContain('2'); // assigned
    });

    it('filters out tasks from boards without access', () => {
      const tasks: MockTask[] = [
        { id: '1', boardId: 'board1', assigneeIds: ['user1'] },
        { id: '2', boardId: 'board2', assigneeIds: ['user1'] },
      ];
      const accessLevels = new Map([['board1', 'full' as const]]);

      const filtered = filterTasksByAccess(tasks, accessLevels, 'user1');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });
  });
});
