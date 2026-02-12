'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences, updateMyWorkPreferences } from '@/lib/actions/user-preferences';
import type { UserPreferences, SavedTaskFilters } from '@/lib/db/schema/users';
import type { TaskFilters } from '@/lib/actions/tasks';

type MyWorkPrefsInput = Parameters<typeof updateMyWorkPreferences>[0];

/** Convert runtime TaskFilters (string | string[]) to saved format (string[]) */
function toSavedFilters(filters: TaskFilters): SavedTaskFilters {
  const normalize = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v : [v];
  return {
    status: normalize(filters.status),
    statusMode: filters.statusMode,
    section: normalize(filters.section),
    sectionMode: filters.sectionMode,
    overdue: filters.overdue,
  };
}

/** Convert saved format back to runtime TaskFilters */
function fromSavedFilters(saved: SavedTaskFilters | undefined): TaskFilters {
  if (!saved) return {};
  return {
    status: saved.status,
    statusMode: saved.statusMode,
    section: saved.section,
    sectionMode: saved.sectionMode,
    overdue: saved.overdue,
  };
}

export function useMyWorkPreferences() {
  const queryClient = useQueryClient();

  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const result = await getUserPreferences();
      return result.success ? result.preferences : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateMyWorkPreferences,
    onMutate: async (input: MyWorkPrefsInput) => {
      await queryClient.cancelQueries({ queryKey: ['userPreferences'] });
      const previous = queryClient.getQueryData<UserPreferences | null>(['userPreferences']);

      queryClient.setQueryData<UserPreferences | null>(['userPreferences'], (old) => {
        if (!old) return old;
        return {
          ...old,
          ...(input.hiddenBoards !== undefined && { hiddenBoards: input.hiddenBoards }),
          ...(input.hiddenColumns !== undefined && { hiddenColumns: input.hiddenColumns }),
          ...(input.myWorkFilters !== undefined && { myWorkFilters: input.myWorkFilters }),
          ...(input.personalTaskFilters !== undefined && { personalTaskFilters: input.personalTaskFilters }),
          ...(input.todaysEvents !== undefined && {
            todaysEvents: { ...old.todaysEvents, ...input.todaysEvents },
          }),
          ...(input.priorityTaskIds !== undefined && { priorityTaskIds: input.priorityTaskIds }),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['userPreferences'], context.previous);
      }
    },
  });

  const save = useCallback(
    (input: MyWorkPrefsInput) => mutation.mutate(input),
    [mutation]
  );

  // --- Hidden boards ---
  const hiddenBoards = userPrefs?.hiddenBoards ?? [];

  const isBoardHidden = useCallback(
    (boardId: string) => hiddenBoards.includes(boardId),
    [hiddenBoards]
  );

  const toggleBoard = useCallback(
    (boardId: string) => {
      const newHidden = hiddenBoards.includes(boardId)
        ? hiddenBoards.filter((b) => b !== boardId)
        : [...hiddenBoards, boardId];
      save({ hiddenBoards: newHidden });
    },
    [hiddenBoards, save]
  );

  const setHiddenBoards = useCallback(
    (boardIds: string[]) => save({ hiddenBoards: boardIds }),
    [save]
  );

  // --- Hidden columns (card items) ---
  const hiddenColumns = userPrefs?.hiddenColumns ?? [];

  const isColumnHidden = useCallback(
    (column: string) => hiddenColumns.includes(column),
    [hiddenColumns]
  );

  const toggleColumn = useCallback(
    (column: string) => {
      const newHidden = hiddenColumns.includes(column)
        ? hiddenColumns.filter((c) => c !== column)
        : [...hiddenColumns, column];
      save({ hiddenColumns: newHidden });
    },
    [hiddenColumns, save]
  );

  const setHiddenColumns = useCallback(
    (columns: string[]) => save({ hiddenColumns: columns }),
    [save]
  );

  // --- My Work filters (Assigned Tasks tab) ---
  const myWorkFilters: TaskFilters = fromSavedFilters(userPrefs?.myWorkFilters);

  const setMyWorkFilters = useCallback(
    (filters: TaskFilters) => save({ myWorkFilters: toSavedFilters(filters) }),
    [save]
  );

  // --- Personal Task filters ---
  const personalTaskFilters: TaskFilters = fromSavedFilters(userPrefs?.personalTaskFilters);

  const setPersonalTaskFilters = useCallback(
    (filters: TaskFilters) => save({ personalTaskFilters: toSavedFilters(filters) }),
    [save]
  );

  // --- Today's Events ---
  const todaysEventsCollapsed = userPrefs?.todaysEvents?.collapsed ?? false;
  const todaysEventsMinimized = userPrefs?.todaysEvents?.minimized ?? false;

  const setTodaysEventsCollapsed = useCallback(
    (collapsed: boolean) => save({ todaysEvents: { collapsed } }),
    [save]
  );

  const setTodaysEventsMinimized = useCallback(
    (minimized: boolean) => save({ todaysEvents: { minimized } }),
    [save]
  );

  // --- Priority task IDs ---
  const priorityTaskIds = userPrefs?.priorityTaskIds ?? [];

  const isPriority = useCallback(
    (taskId: string) => priorityTaskIds.includes(taskId),
    [priorityTaskIds]
  );

  const togglePriority = useCallback(
    (taskId: string) => {
      const newIds = priorityTaskIds.includes(taskId)
        ? priorityTaskIds.filter((id) => id !== taskId)
        : [...priorityTaskIds, taskId];
      save({ priorityTaskIds: newIds });
    },
    [priorityTaskIds, save]
  );

  const clearPriorities = useCallback(
    () => save({ priorityTaskIds: [] }),
    [save]
  );

  return {
    // Boards
    hiddenBoards,
    isBoardHidden,
    toggleBoard,
    setHiddenBoards,
    // Card items
    hiddenColumns,
    isColumnHidden,
    toggleColumn,
    setHiddenColumns,
    // My Work filters
    myWorkFilters,
    setMyWorkFilters,
    // Personal Task filters
    personalTaskFilters,
    setPersonalTaskFilters,
    // Today's Events
    todaysEventsCollapsed,
    todaysEventsMinimized,
    setTodaysEventsCollapsed,
    setTodaysEventsMinimized,
    // Priority tasks
    priorityTaskIds,
    isPriority,
    togglePriority,
    clearPriorities,
  };
}
