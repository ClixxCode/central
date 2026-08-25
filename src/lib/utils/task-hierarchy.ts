export interface AddAsSubtaskEligibilityTask {
  boardId: string;
  parentTaskId: string | null;
  subtaskCount: number;
  recurringConfig: unknown | null;
  recurringGroupId: string | null;
  archivedAt: Date | null;
}

/** Returns the first user-facing reason a selection cannot be demoted. */
export function getAddAsSubtaskBlockReason(
  selectedTasks: AddAsSubtaskEligibilityTask[]
): string | null {
  if (selectedTasks.length === 0) return 'Select at least one task';
  if (selectedTasks.some((task) => task.parentTaskId !== null)) {
    return 'Only top-level tasks can be added as subtasks';
  }
  if (new Set(selectedTasks.map((task) => task.boardId)).size !== 1) {
    return 'Selected tasks must be on the same board';
  }
  if (selectedTasks.some((task) => task.subtaskCount > 0)) {
    return 'Tasks with subtasks cannot be added as subtasks';
  }
  if (selectedTasks.some((task) => task.recurringConfig !== null || task.recurringGroupId !== null)) {
    return 'Recurring tasks cannot be added as subtasks';
  }
  if (selectedTasks.some((task) => task.archivedAt !== null)) {
    return 'Archived tasks cannot be added as subtasks';
  }
  return null;
}
