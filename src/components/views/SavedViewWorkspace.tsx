'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Kanban, LayoutList, Loader2, Play, Save, SlidersHorizontal, TableRowsSplit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RollupSourceSelector } from '@/components/rollups/RollupSourceSelector';
import { RollupBoardView } from '@/components/rollups/RollupBoardView';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import { MultiSelectFloatingBar, type BulkEditPayload } from '@/components/tasks/MultiSelectFloatingBar';
import { MoveTasksDialog } from '@/components/tasks/MoveTasksDialog';
import { useAvailableSourceBoards } from '@/lib/hooks/useRollupBoards';
import {
  useCreateSavedView,
  useSavedViewPreview,
  useUpdateSavedView,
  savedViewKeys,
} from '@/lib/hooks/useSavedViews';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import {
  useBulkDeleteTasks,
  useBulkDuplicateTasks,
  useBulkUpdateTasks,
  usePromoteSubtasks,
} from '@/lib/hooks/useTasks';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { cn } from '@/lib/utils';
import type { SavedViewWithSources } from '@/lib/actions/saved-views';
import type { TaskFilters, TaskSortOptions } from '@/lib/actions/tasks';
import type { SavedViewFilters, SavedViewPresentation } from '@/lib/db/schema';
import type { CreateSavedViewInput } from '@/lib/validations/saved-view';
import type { TableSortOptions } from '@/components/shared/TaskTable';

const layoutOptions = [
  { value: 'swimlane' as const, label: 'Swimlane', icon: TableRowsSplit },
  { value: 'kanban' as const, label: 'Kanban', icon: Kanban },
  { value: 'table' as const, label: 'Table', icon: LayoutList },
];

const defaultPresentation: SavedViewPresentation = {
  layout: 'swimlane',
  sort: { field: 'position', direction: 'asc' },
  tableColumns: {
    title: true,
    status: true,
    section: true,
    assignees: true,
    dueDate: true,
    source: true,
  },
  cardFields: { section: true, dueDate: true, assignees: true },
};

function toSemanticFilters(
  filters: TaskFilters,
  statusOptions: { id: string; label: string }[],
  sectionOptions: { id: string; label: string }[]
): SavedViewFilters {
  const statuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : [];
  const sections = Array.isArray(filters.section) ? filters.section : filters.section ? [filters.section] : [];
  const assignees = Array.isArray(filters.assigneeId)
    ? filters.assigneeId
    : filters.assigneeId ? [filters.assigneeId] : [];
  const statusLabels = [...new Set(statuses.map((id) => statusOptions.find((option) => option.id === id)?.label).filter(Boolean))] as string[];
  const sectionLabels = [...new Set(sections
    .filter((id) => id !== '__none__')
    .map((id) => sectionOptions.find((option) => option.id === id)?.label)
    .filter(Boolean))] as string[];
  return {
    ...(statusLabels.length && { statusLabels, statusMode: filters.statusMode }),
    ...(sectionLabels.length && { sectionLabels }),
    ...(sections.includes('__none__') && { includeNoSection: true }),
    ...((sectionLabels.length || sections.includes('__none__')) && { sectionMode: filters.sectionMode }),
    ...(assignees.length && { assigneeIds: assignees, assigneeMode: filters.assigneeMode }),
    ...(filters.overdue && { overdue: true }),
  };
}

function fromSemanticFilters(
  filters: SavedViewFilters,
  statusOptions: { id: string; label: string }[],
  sectionOptions: { id: string; label: string }[]
): TaskFilters {
  const statuses = statusOptions.filter((option) => filters.statusLabels?.includes(option.label)).map((option) => option.id);
  const sections = sectionOptions.filter((option) => filters.sectionLabels?.includes(option.label)).map((option) => option.id);
  if (filters.includeNoSection) sections.push('__none__');
  return {
    status: statuses.length ? statuses : undefined,
    statusMode: statuses.length ? filters.statusMode : undefined,
    section: sections.length ? sections : undefined,
    sectionMode: sections.length ? filters.sectionMode : undefined,
    assigneeId: filters.assigneeIds?.length ? filters.assigneeIds : undefined,
    assigneeMode: filters.assigneeIds?.length ? filters.assigneeMode : undefined,
    overdue: filters.overdue,
  };
}

interface SavedViewWorkspaceProps {
  view?: SavedViewWithSources;
}

export function SavedViewWorkspace({ view }: SavedViewWorkspaceProps) {
  const router = useRouter();
  const createView = useCreateSavedView();
  const updateView = useUpdateSavedView();
  const { data: availableBoards = [], isLoading: boardsLoading } = useAvailableSourceBoards();
  const [name, setName] = React.useState(view?.name ?? '');
  const [boardIds, setBoardIds] = React.useState(view?.sources.map((source) => source.boardId) ?? []);
  const [filters, setFilters] = React.useState<TaskFilters>({});
  const [presentation, setPresentation] = React.useState<SavedViewPresentation>(view?.presentation ?? defaultPresentation);
  const [reviewModeEnabled, setReviewModeEnabled] = React.useState(view?.reviewModeEnabled ?? false);
  const [filtersHydrated, setFiltersHydrated] = React.useState(!view);
  const [baseline, setBaseline] = React.useState('');

  const querySort: TaskSortOptions = presentation.sort.field === 'client'
    ? { field: 'position', direction: presentation.sort.direction }
    : presentation.sort as TaskSortOptions;
  const { data, isLoading, error } = useSavedViewPreview(boardIds, filters, querySort);
  const tasks = React.useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const statusOptions = React.useMemo(() => data?.statusOptions ?? [], [data?.statusOptions]);
  const sectionOptions = React.useMemo(() => data?.sectionOptions ?? [], [data?.sectionOptions]);
  const assignableUsers = React.useMemo(() => data?.assignableUsers ?? [], [data?.assignableUsers]);

  React.useEffect(() => {
    if (view && data && !filtersHydrated) {
      setFilters(fromSemanticFilters(view.filters, data.statusOptions, data.sectionOptions));
      setFiltersHydrated(true);
    }
  }, [view, data, filtersHydrated]);

  const semanticFilters = React.useMemo(
    () => toSemanticFilters(filters, statusOptions, sectionOptions),
    [filters, statusOptions, sectionOptions]
  );
  const snapshot = React.useMemo(() => JSON.stringify({
    name: name.trim(), boardIds: [...boardIds].sort(), filters: semanticFilters,
    presentation, reviewModeEnabled,
  }), [name, boardIds, semanticFilters, presentation, reviewModeEnabled]);

  React.useEffect(() => {
    if (!filtersHydrated || baseline) return;
    setBaseline(snapshot);
  }, [filtersHydrated, baseline, snapshot]);
  const isDirty = !!baseline && snapshot !== baseline;

  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  React.useEffect(() => {
    if (!isDirty) return;
    const guardInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (!window.confirm('Discard unsaved changes to this view?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guardInternalNavigation, true);
    return () => document.removeEventListener('click', guardInternalNavigation, true);
  }, [isDirty]);

  useRealtimeInvalidation({
    channel: `saved-view-${view?.id ?? 'builder'}`,
    table: 'tasks',
    filter: boardIds.length ? `board_id=in.(${boardIds.join(',')})` : undefined,
    queryKeys: [view ? savedViewKeys.tasks(view.id) : savedViewKeys.all],
    enabled: boardIds.length > 0,
  });

  const definition = React.useMemo<CreateSavedViewInput>(() => ({
    name: name.trim(),
    sourceBoardIds: boardIds,
    filters: semanticFilters,
    presentation,
    reviewModeEnabled,
  }), [name, boardIds, semanticFilters, presentation, reviewModeEnabled]);

  const save = async () => {
    if (!definition.name || definition.sourceBoardIds.length === 0) return;
    if (view) {
      await updateView.mutateAsync({ viewId: view.id, input: definition });
      setBaseline(snapshot);
      router.refresh();
    } else {
      const created = await createView.mutateAsync(definition);
      router.push(`/views/${created.id}`);
    }
  };

  const saveAsNew = async () => {
    const nextName = window.prompt('Name this new view', `${name} copy`)?.trim();
    if (!nextName) return;
    const created = await createView.mutateAsync({ ...definition, name: nextName });
    router.push(`/views/${created.id}`);
  };

  const toggleTableColumn = (column: keyof SavedViewPresentation['tableColumns']) => {
    const next = { ...presentation.tableColumns, [column]: !presentation.tableColumns[column] };
    if (!Object.values(next).some(Boolean)) return;
    setPresentation({ ...presentation, tableColumns: next });
  };
  const toggleCardField = (field: keyof SavedViewPresentation['cardFields']) => {
    setPresentation({
      ...presentation,
      cardFields: { ...presentation.cardFields, [field]: !presentation.cardFields[field] },
    });
  };

  const hiddenCardItems = React.useMemo(() => {
    const hidden = new Set<string>();
    for (const [key, visible] of Object.entries(presentation.cardFields)) if (!visible) hidden.add(key);
    return hidden;
  }, [presentation.cardFields]);

  const fauxRollup = React.useMemo(() => ({
    id: view?.id ?? 'new-saved-view',
    name: name || 'Untitled view',
    type: 'rollup' as const,
    reviewModeEnabled,
    createdBy: view?.createdBy ?? null,
    createdAt: view?.createdAt ?? new Date(),
    sources: boardIds.map((boardId) => {
      const board = availableBoards.find((candidate) => candidate.id === boardId);
      return {
        boardId,
        boardName: board?.name ?? 'Board',
        clientId: board?.clientId ?? null,
        clientName: board?.clientName ?? null,
        clientSlug: board?.clientSlug ?? null,
        clientColor: board?.clientColor ?? null,
        clientIcon: board?.clientIcon ?? null,
      };
    }),
  }), [view, name, reviewModeEnabled, boardIds, availableBoards]);

  const { activeReviewBoardId, setActiveReviewBoardId } = useBoardViewStore();
  const reviewMode = activeReviewBoardId === fauxRollup.id;
  const [reviewIndex, setReviewIndex] = React.useState(0);

  const bulkUpdate = useBulkUpdateTasks();
  const bulkDuplicate = useBulkDuplicateTasks();
  const bulkDelete = useBulkDeleteTasks();
  const promoteSubtasks = usePromoteSubtasks();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const lastSelectedId = React.useRef<string | null>(null);
  const [moveDialog, setMoveDialog] = React.useState<{ open: boolean; payload: BulkEditPayload | null }>({ open: false, payload: null });
  const clearSelection = React.useCallback(() => { setSelectedTaskIds(new Set()); lastSelectedId.current = null; }, []);
  const onTaskMultiSelect = React.useCallback((taskId: string, shift: boolean, ordered: string[]) => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);
      if (shift && lastSelectedId.current) {
        const a = ordered.indexOf(lastSelectedId.current);
        const b = ordered.indexOf(taskId);
        if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(ordered[i]);
      } else if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      lastSelectedId.current = taskId;
      return next;
    });
  }, []);
  const handleBulkApply = (payload: BulkEditPayload) => {
    if (payload.boardId) return setMoveDialog({ open: true, payload });
    bulkUpdate.mutate({
      taskIds: [...selectedTaskIds], status: payload.status, section: payload.section,
      dueDate: payload.dueDate, addAssigneeIds: payload.addAssigneeIds,
    }, { onSuccess: clearSelection });
  };
  const confirmMove = () => {
    const payload = moveDialog.payload;
    if (!payload) return;
    bulkUpdate.mutate({
      taskIds: [...selectedTaskIds], boardId: payload.boardId, status: payload.status,
      section: payload.section, dueDate: payload.dueDate, addAssigneeIds: payload.addAssigneeIds,
    }, { onSuccess: clearSelection });
  };

  const pending = createView.isPending || updateView.isPending;
  const canSave = !!name.trim() && boardIds.length > 0 && (!view || view.canEdit);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(240px,0.7fr)_minmax(320px,1.3fr)_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="view-name">View name</Label>
          <Input id="view-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weekly delivery review" />
        </div>
        <div className="space-y-2">
          <Label>Boards</Label>
          {boardsLoading ? <div className="h-10 animate-pulse rounded bg-muted" /> : (
            <RollupSourceSelector
              value={boardIds}
              onChange={(ids) => { setBoardIds(ids); setFilters({}); setFiltersHydrated(true); }}
              boards={availableBoards}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {view && <Button variant="outline" onClick={saveAsNew} disabled={pending || boardIds.length === 0}>Save as new</Button>}
          {(!view || view.canEdit) && (
            <Button onClick={save} disabled={pending || !canSave || (!!view && !isDirty)}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {view ? 'Save changes' : 'Save view'}
            </Button>
          )}
        </div>
      </div>

      {view && !view.canEdit && (
        <p className="text-sm text-muted-foreground">You can explore changes locally. Use Save as new to keep them.</p>
      )}
      {(view?.unavailableSourceCount ?? 0) > 0 && (
        <div className="flex gap-3 rounded-lg border bg-muted/30 p-4">
          <AlertTriangle className="size-4" />
          <div><p className="text-sm font-medium">Partial results</p>
          <p className="text-sm text-muted-foreground">{view!.unavailableSourceCount} source {view!.unavailableSourceCount === 1 ? 'board is' : 'boards are'} unavailable to you.</p></div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            {layoutOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setPresentation({ ...presentation, layout: option.value })}
                className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm', presentation.layout === option.value ? 'bg-background shadow-sm' : 'hover:bg-background/50')}>
                <option.icon className="size-4" />{option.label}
              </button>
            ))}
          </div>
          {presentation.layout === 'table' ? (
            <TableColumnsButton columns={[
              { id: 'source', label: 'Board' }, { id: 'status', label: 'Status' },
              { id: 'section', label: 'Section' }, { id: 'assignees', label: 'Assignees' },
              { id: 'dueDate', label: 'Due Date' },
            ]} visibleColumns={presentation.tableColumns} onToggle={(column) => toggleTableColumn(column as keyof SavedViewPresentation['tableColumns'])} />
          ) : (
            <TableColumnsButton columns={[
              { id: 'section', label: 'Section' }, { id: 'dueDate', label: 'Due Date' },
              { id: 'assignees', label: 'Assignees' },
            ]} visibleColumns={presentation.cardFields} onToggle={(field) => toggleCardField(field as keyof SavedViewPresentation['cardFields'])}
              label="Card Items" menuLabel="Toggle card items" icon={SlidersHorizontal} />
          )}
          <TaskFilterBar filters={filters} onFiltersChange={setFilters} statusOptions={statusOptions} sectionOptions={sectionOptions} assignableUsers={assignableUsers} />
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Sort view" className="h-9 rounded-md border bg-background px-2 text-sm" value={presentation.sort.field}
            onChange={(event) => setPresentation({ ...presentation, sort: { ...presentation.sort, field: event.target.value as SavedViewPresentation['sort']['field'] } })}>
            <option value="position">Board order</option><option value="client">Client</option><option value="title">Title</option>
            <option value="status">Status</option><option value="dueDate">Due date</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setPresentation({ ...presentation, sort: { ...presentation.sort, direction: presentation.sort.direction === 'asc' ? 'desc' : 'asc' } })}>
            {presentation.sort.direction === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
          <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Label htmlFor="review-mode" className="text-xs">Review</Label>
            <Switch id="review-mode" checked={reviewModeEnabled} onCheckedChange={setReviewModeEnabled} />
          </div>
          {reviewModeEnabled && presentation.layout === 'swimlane' && (
            <Button variant={reviewMode ? 'default' : 'outline'} size="icon" className="size-9" onClick={() => setActiveReviewBoardId(reviewMode ? null : fauxRollup.id)}>
              {reviewMode ? <X className="size-4" /> : <Play className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      {boardIds.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">Select at least one board to preview tasks.</div>
      ) : isLoading || !filtersHydrated ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" />Loading preview…</div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4"><p className="font-medium text-destructive">Could not load tasks</p><p className="text-sm text-destructive">{error.message}</p></div>
      ) : (
        <RollupBoardView
          rollupBoard={fauxRollup} tasks={tasks} statusOptions={statusOptions} sectionOptions={sectionOptions}
          assignableUsers={assignableUsers} viewMode={presentation.layout} tableColumns={presentation.tableColumns}
          hiddenCardItems={hiddenCardItems} tableSort={presentation.sort as TableSortOptions}
          onTableSortChange={(sort) => setPresentation({ ...presentation, sort })}
          reviewMode={reviewMode} reviewIndex={reviewIndex} onReviewIndexChange={setReviewIndex}
          onExitReview={() => setActiveReviewBoardId(null)} selectedTaskIds={selectedTaskIds}
          isMultiSelectMode={selectedTaskIds.size > 0} onTaskMultiSelect={onTaskMultiSelect}
        />
      )}

      {selectedTaskIds.size > 0 && (
        <MultiSelectFloatingBar selectedCount={selectedTaskIds.size} statusOptions={statusOptions} sectionOptions={sectionOptions}
          assignableUsers={assignableUsers} currentBoardId="" onApply={handleBulkApply}
          onDuplicate={() => bulkDuplicate.mutate([...selectedTaskIds], { onSuccess: clearSelection })}
          onPromote={() => promoteSubtasks.mutate([...selectedTaskIds], { onSuccess: clearSelection })}
          onDelete={() => bulkDelete.mutate([...selectedTaskIds], { onSuccess: clearSelection })}
          onRemoveAllAssignees={() => bulkUpdate.mutate({ taskIds: [...selectedTaskIds], removeAllAssignees: true }, { onSuccess: clearSelection })}
          onCancel={clearSelection} isPending={bulkUpdate.isPending} isDuplicating={bulkDuplicate.isPending}
          isPromoting={promoteSubtasks.isPending} isDeleting={bulkDelete.isPending}
          selectedTasksHaveAssignees={tasks.some((task) => selectedTaskIds.has(task.id) && task.assignees.length > 0)}
          selectedSubtaskCount={tasks.filter((task) => selectedTaskIds.has(task.id) && !!task.parentTaskId).length} />
      )}
      <MoveTasksDialog open={moveDialog.open} onOpenChange={(open) => !open && setMoveDialog({ open: false, payload: null })}
        taskCount={selectedTaskIds.size} targetBoardName={moveDialog.payload?.targetBoardName ?? ''} onConfirm={confirmMove} />
    </div>
  );
}
