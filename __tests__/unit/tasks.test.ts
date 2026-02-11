import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskWithAssignees, TaskFilters, TaskSortOptions } from '@/lib/actions/tasks';

// Test data factories
function createMockTask(overrides: Partial<TaskWithAssignees> = {}): TaskWithAssignees {
  return {
    id: 'task-1',
    boardId: 'board-1',
    title: 'Test Task',
    description: null,
    status: 'todo',
    section: null,
    dueDate: null,
    dateFlexibility: 'not_set',
    recurringConfig: null,
    recurringGroupId: null,
    position: 0,
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    assignees: [],
    commentCount: 0,
    attachmentCount: 0,
    hasNewComments: false,
    parentTaskId: null,
    subtaskCount: 0,
    subtaskCompletedCount: 0,
    archivedAt: null,
    ...overrides,
  };
}

describe('Task Types', () => {
  describe('TaskWithAssignees', () => {
    it('allows creating a task with all required fields', () => {
      const task = createMockTask();
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Test Task');
      expect(task.assignees).toEqual([]);
    });

    it('allows tasks with assignees', () => {
      const task = createMockTask({
        assignees: [
          { id: 'user-1', email: 'user@example.com', name: 'Test User', avatarUrl: null, deactivatedAt: null },
        ],
      });
      expect(task.assignees).toHaveLength(1);
      expect(task.assignees[0].email).toBe('user@example.com');
    });

    it('allows tasks with all date flexibility values', () => {
      const flexibilities = ['not_set', 'flexible', 'semi_flexible', 'not_flexible'] as const;

      for (const flexibility of flexibilities) {
        const task = createMockTask({ dateFlexibility: flexibility });
        expect(task.dateFlexibility).toBe(flexibility);
      }
    });

    it('allows tasks with recurring config', () => {
      const task = createMockTask({
        recurringConfig: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        },
      });
      expect(task.recurringConfig?.frequency).toBe('weekly');
      expect(task.recurringConfig?.daysOfWeek).toEqual([1, 3, 5]);
    });
  });

  describe('TaskFilters', () => {
    it('allows filtering by single status', () => {
      const filters: TaskFilters = {
        status: 'todo',
      };
      expect(filters.status).toBe('todo');
    });

    it('allows filtering by multiple statuses', () => {
      const filters: TaskFilters = {
        status: ['todo', 'in-progress'],
      };
      expect(filters.status).toHaveLength(2);
    });

    it('allows filtering by single assignee', () => {
      const filters: TaskFilters = {
        assigneeId: 'user-1',
      };
      expect(filters.assigneeId).toBe('user-1');
    });

    it('allows filtering by multiple assignees', () => {
      const filters: TaskFilters = {
        assigneeId: ['user-1', 'user-2'],
      };
      expect(filters.assigneeId).toHaveLength(2);
    });

    it('allows combining multiple filters', () => {
      const filters: TaskFilters = {
        status: ['todo', 'in-progress'],
        section: 'frontend',
        assigneeId: 'user-1',
      };
      expect(filters.status).toHaveLength(2);
      expect(filters.section).toBe('frontend');
      expect(filters.assigneeId).toBe('user-1');
    });
  });

  describe('TaskSortOptions', () => {
    it('allows sorting by position ascending', () => {
      const sort: TaskSortOptions = {
        field: 'position',
        direction: 'asc',
      };
      expect(sort.field).toBe('position');
      expect(sort.direction).toBe('asc');
    });

    it('allows sorting by due date descending', () => {
      const sort: TaskSortOptions = {
        field: 'dueDate',
        direction: 'desc',
      };
      expect(sort.field).toBe('dueDate');
      expect(sort.direction).toBe('desc');
    });

    it('allows all sort fields', () => {
      const fields = ['position', 'dueDate', 'createdAt', 'title', 'status'] as const;

      for (const field of fields) {
        const sort: TaskSortOptions = { field, direction: 'asc' };
        expect(sort.field).toBe(field);
      }
    });
  });
});

describe('Task Filtering Logic', () => {
  const tasks = [
    createMockTask({ id: '1', status: 'todo', section: 'frontend' }),
    createMockTask({ id: '2', status: 'in-progress', section: 'backend' }),
    createMockTask({ id: '3', status: 'todo', section: 'backend' }),
    createMockTask({ id: '4', status: 'complete', section: null }),
  ];

  function filterTasks(taskList: TaskWithAssignees[], filters: TaskFilters): TaskWithAssignees[] {
    return taskList.filter((task) => {
      // Status filter
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(task.status)) return false;
      }

      // Section filter
      if (filters.section) {
        const sections = Array.isArray(filters.section) ? filters.section : [filters.section];
        if (!task.section || !sections.includes(task.section)) return false;
      }

      // Assignee filter
      if (filters.assigneeId) {
        const assigneeIds = Array.isArray(filters.assigneeId) ? filters.assigneeId : [filters.assigneeId];
        const taskAssigneeIds = task.assignees.map((a) => a.id);
        if (!assigneeIds.some((id) => taskAssigneeIds.includes(id))) return false;
      }

      return true;
    });
  }

  it('filters by single status', () => {
    const filtered = filterTasks(tasks, { status: 'todo' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((t) => t.status === 'todo')).toBe(true);
  });

  it('filters by multiple statuses', () => {
    const filtered = filterTasks(tasks, { status: ['todo', 'in-progress'] });
    expect(filtered).toHaveLength(3);
  });

  it('filters by section', () => {
    const filtered = filterTasks(tasks, { section: 'backend' });
    expect(filtered).toHaveLength(2);
  });

  it('filters by status and section combined', () => {
    const filtered = filterTasks(tasks, { status: 'todo', section: 'frontend' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('returns empty array when no matches', () => {
    const filtered = filterTasks(tasks, { status: 'review' });
    expect(filtered).toHaveLength(0);
  });

  it('returns all tasks with empty filters', () => {
    const filtered = filterTasks(tasks, {});
    expect(filtered).toHaveLength(4);
  });
});

describe('Task Sorting Logic', () => {
  const tasks = [
    createMockTask({ id: '1', title: 'Zebra', position: 2, dueDate: '2024-03-01' }),
    createMockTask({ id: '2', title: 'Alpha', position: 0, dueDate: '2024-01-01' }),
    createMockTask({ id: '3', title: 'Middle', position: 1, dueDate: null }),
  ];

  function sortTasks(taskList: TaskWithAssignees[], sort: TaskSortOptions): TaskWithAssignees[] {
    return [...taskList].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'position':
          comparison = a.position - b.position;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'dueDate':
          // null dates go to the end
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = a.dueDate.localeCompare(b.dueDate);
          break;
        default:
          comparison = 0;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }

  it('sorts by position ascending', () => {
    const sorted = sortTasks(tasks, { field: 'position', direction: 'asc' });
    expect(sorted[0].position).toBe(0);
    expect(sorted[1].position).toBe(1);
    expect(sorted[2].position).toBe(2);
  });

  it('sorts by position descending', () => {
    const sorted = sortTasks(tasks, { field: 'position', direction: 'desc' });
    expect(sorted[0].position).toBe(2);
    expect(sorted[1].position).toBe(1);
    expect(sorted[2].position).toBe(0);
  });

  it('sorts by title ascending', () => {
    const sorted = sortTasks(tasks, { field: 'title', direction: 'asc' });
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Middle');
    expect(sorted[2].title).toBe('Zebra');
  });

  it('sorts by dueDate with nulls at end', () => {
    const sorted = sortTasks(tasks, { field: 'dueDate', direction: 'asc' });
    expect(sorted[0].dueDate).toBe('2024-01-01');
    expect(sorted[1].dueDate).toBe('2024-03-01');
    expect(sorted[2].dueDate).toBe(null);
  });
});

describe('Task Position Calculation', () => {
  function calculateNewPosition(tasks: TaskWithAssignees[], targetIndex: number): number {
    if (tasks.length === 0) return 0;
    if (targetIndex >= tasks.length) return tasks[tasks.length - 1].position + 1;
    if (targetIndex === 0) {
      // Place before first item
      return tasks[0].position - 1;
    }
    // Place between two items
    const before = tasks[targetIndex - 1].position;
    const after = tasks[targetIndex].position;
    return (before + after) / 2;
  }

  it('returns 0 for empty list', () => {
    expect(calculateNewPosition([], 0)).toBe(0);
  });

  it('increments from last position when adding at end', () => {
    const tasks = [
      createMockTask({ position: 0 }),
      createMockTask({ position: 1 }),
    ];
    expect(calculateNewPosition(tasks, 2)).toBe(2);
  });

  it('decrements from first position when adding at start', () => {
    const tasks = [
      createMockTask({ position: 0 }),
      createMockTask({ position: 1 }),
    ];
    expect(calculateNewPosition(tasks, 0)).toBe(-1);
  });

  it('calculates midpoint when adding between items', () => {
    const tasks = [
      createMockTask({ position: 0 }),
      createMockTask({ position: 2 }),
    ];
    expect(calculateNewPosition(tasks, 1)).toBe(1);
  });
});
