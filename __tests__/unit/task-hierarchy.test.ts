import { describe, expect, it } from 'vitest';
import { getAddAsSubtaskBlockReason, type AddAsSubtaskEligibilityTask } from '@/lib/utils/task-hierarchy';

const eligibleTask: AddAsSubtaskEligibilityTask = {
  boardId: 'board-1',
  parentTaskId: null,
  subtaskCount: 0,
  recurringConfig: null,
  recurringGroupId: null,
  archivedAt: null,
};

describe('getAddAsSubtaskBlockReason', () => {
  it('allows eligible same-board top-level tasks', () => {
    expect(getAddAsSubtaskBlockReason([eligibleTask, { ...eligibleTask }])).toBeNull();
  });

  it.each([
    [{ ...eligibleTask, parentTaskId: 'parent-1' }, 'Only top-level tasks can be added as subtasks'],
    [{ ...eligibleTask, subtaskCount: 1 }, 'Tasks with subtasks cannot be added as subtasks'],
    [{ ...eligibleTask, recurringGroupId: 'series-1' }, 'Recurring tasks cannot be added as subtasks'],
    [{ ...eligibleTask, archivedAt: new Date() }, 'Archived tasks cannot be added as subtasks'],
  ])('blocks invalid task hierarchy state', (task, expected) => {
    expect(getAddAsSubtaskBlockReason([task])).toBe(expected);
  });

  it('blocks a multi-board selection', () => {
    expect(
      getAddAsSubtaskBlockReason([eligibleTask, { ...eligibleTask, boardId: 'board-2' }])
    ).toBe('Selected tasks must be on the same board');
  });
});
