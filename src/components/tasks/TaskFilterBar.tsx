'use client';

import * as React from 'react';
import { Filter, X, Check, Clock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import type { TaskFilters, FilterMode } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';

interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  hideAssigneeFilter?: boolean;
  additionalFilterCount?: number;
  onClearAll?: () => void;
  /** Rendered after assignee filter, before overdue */
  renderBeforeOverdue?: React.ReactNode;
}

export function TaskFilterBar({
  filters,
  onFiltersChange,
  statusOptions,
  sectionOptions,
  assignableUsers,
  hideAssigneeFilter,
  additionalFilterCount = 0,
  onClearAll,
  renderBeforeOverdue,
}: TaskFilterBarProps) {
  const baseFilterCount = countActiveFilters(filters);
  const activeFilterCount = baseFilterCount + additionalFilterCount;

  const clearFilters = () => {
    onFiltersChange({});
    onClearAll?.();
  };

  const toggleStatusFilter = (statusId: string) => {
    const currentStatuses = normalizeFilterValue(filters.status);
    const newStatuses = currentStatuses.includes(statusId)
      ? currentStatuses.filter((s) => s !== statusId)
      : [...currentStatuses, statusId];

    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
      statusMode: newStatuses.length > 0 ? filters.statusMode : undefined,
    });
  };

  const setAllStatuses = (allIds: string[], selected: string[]) => {
    const allSelected = allIds.length === selected.length;
    onFiltersChange({
      ...filters,
      status: allSelected ? undefined : allIds,
      statusMode: allSelected ? undefined : filters.statusMode,
    });
  };

  const toggleSectionFilter = (sectionId: string) => {
    const currentSections = normalizeFilterValue(filters.section);
    const newSections = currentSections.includes(sectionId)
      ? currentSections.filter((s) => s !== sectionId)
      : [...currentSections, sectionId];

    onFiltersChange({
      ...filters,
      section: newSections.length > 0 ? newSections : undefined,
      sectionMode: newSections.length > 0 ? filters.sectionMode : undefined,
    });
  };

  const setAllSections = (allIds: string[], selected: string[]) => {
    const allSelected = allIds.length === selected.length;
    onFiltersChange({
      ...filters,
      section: allSelected ? undefined : allIds,
      sectionMode: allSelected ? undefined : filters.sectionMode,
    });
  };

  const toggleAssigneeFilter = (userId: string) => {
    const currentAssignees = normalizeFilterValue(filters.assigneeId);
    const newAssignees = currentAssignees.includes(userId)
      ? currentAssignees.filter((a) => a !== userId)
      : [...currentAssignees, userId];

    onFiltersChange({
      ...filters,
      assigneeId: newAssignees.length > 0 ? newAssignees : undefined,
      assigneeMode: newAssignees.length > 0 ? filters.assigneeMode : undefined,
    });
  };

  const setAllAssignees = (allIds: string[], selected: string[]) => {
    const allSelected = allIds.length === selected.length;
    onFiltersChange({
      ...filters,
      assigneeId: allSelected ? undefined : allIds,
      assigneeMode: allSelected ? undefined : filters.assigneeMode,
    });
  };

  const handleStatusModeChange = (mode: FilterMode) => {
    onFiltersChange({ ...filters, statusMode: mode });
  };

  const handleSectionModeChange = (mode: FilterMode) => {
    onFiltersChange({ ...filters, sectionMode: mode });
  };

  const handleAssigneeModeChange = (mode: FilterMode) => {
    onFiltersChange({ ...filters, assigneeMode: mode });
  };

  const selectedStatuses = normalizeFilterValue(filters.status);
  const selectedSections = normalizeFilterValue(filters.section);
  const selectedAssignees = normalizeFilterValue(filters.assigneeId);

  // All section IDs including __none__
  const allSectionIds = ['__none__', ...sectionOptions.map((s) => s.id)];
  const allStatusIds = statusOptions.map((s) => s.id);
  const allAssigneeIds = assignableUsers.map((u) => u.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Filter */}
      <FilterPopover
        label="Status"
        selectedCount={selectedStatuses.length}
        mode={filters.statusMode}
        onModeChange={handleStatusModeChange}
        onClear={() => onFiltersChange({ ...filters, status: undefined, statusMode: undefined })}
      >
        <Command>
          <CommandInput placeholder="Search status..." />
          <CommandList>
            <CommandEmpty>No status found.</CommandEmpty>
            <SelectAllItem
              allIds={allStatusIds}
              selectedIds={selectedStatuses}
              onToggle={() => setAllStatuses(allStatusIds, selectedStatuses)}
            />
            <CommandSeparator />
            <CommandGroup>
              {statusOptions.map((status) => (
                <CommandItem
                  key={status.id}
                  onSelect={() => toggleStatusFilter(status.id)}
                >
                  <div
                    className={cn(
                      'mr-2 flex size-4 items-center justify-center rounded-sm border',
                      selectedStatuses.includes(status.id)
                        ? 'border-zinc-700 bg-zinc-700 text-white dark:border-primary dark:bg-primary dark:text-background'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {selectedStatuses.includes(status.id) && (
                      <Check className="size-3" />
                    )}
                  </div>
                  <span
                    className="mr-2 size-2.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </FilterPopover>

      {/* Section Filter */}
      {sectionOptions.length > 0 && (
        <FilterPopover
          label="Section"
          selectedCount={selectedSections.length}
          mode={filters.sectionMode}
          onModeChange={handleSectionModeChange}
          onClear={() => onFiltersChange({ ...filters, section: undefined, sectionMode: undefined })}
        >
          <Command>
            <CommandInput placeholder="Search section..." />
            <CommandList>
              <CommandEmpty>No section found.</CommandEmpty>
              <SelectAllItem
                allIds={allSectionIds}
                selectedIds={selectedSections}
                onToggle={() => setAllSections(allSectionIds, selectedSections)}
              />
              <CommandSeparator />
              <CommandGroup>
                {/* No Section option */}
                <CommandItem
                  onSelect={() => toggleSectionFilter('__none__')}
                >
                  <div
                    className={cn(
                      'mr-2 flex size-4 items-center justify-center rounded-sm border',
                      selectedSections.includes('__none__')
                        ? 'border-zinc-700 bg-zinc-700 text-white dark:border-primary dark:bg-primary dark:text-background'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {selectedSections.includes('__none__') && (
                      <Check className="size-3" />
                    )}
                  </div>
                  <span className="mr-2 size-2.5 rounded border border-dashed border-muted-foreground/50" />
                  No Section
                </CommandItem>
                {sectionOptions.map((section) => (
                  <CommandItem
                    key={section.id}
                    onSelect={() => toggleSectionFilter(section.id)}
                  >
                    <div
                      className={cn(
                        'mr-2 flex size-4 items-center justify-center rounded-sm border',
                        selectedSections.includes(section.id)
                          ? 'border-zinc-700 bg-zinc-700 text-white dark:border-primary dark:bg-primary dark:text-background'
                          : 'border-muted-foreground/30'
                      )}
                    >
                      {selectedSections.includes(section.id) && (
                        <Check className="size-3" />
                      )}
                    </div>
                    <span
                      className="mr-2 size-2.5 rounded"
                      style={{ backgroundColor: section.color }}
                    />
                    {section.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </FilterPopover>
      )}

      {/* Assignee Filter */}
      {!hideAssigneeFilter && (
        <FilterPopover
          label="Assignee"
          selectedCount={selectedAssignees.length}
          mode={filters.assigneeMode}
          onModeChange={handleAssigneeModeChange}
          onClear={() => onFiltersChange({ ...filters, assigneeId: undefined, assigneeMode: undefined })}
        >
          <Command>
            <CommandInput placeholder="Search assignee..." />
            <CommandList>
              <CommandEmpty>No assignee found.</CommandEmpty>
              <SelectAllItem
                allIds={allAssigneeIds}
                selectedIds={selectedAssignees}
                onToggle={() => setAllAssignees(allAssigneeIds, selectedAssignees)}
              />
              <CommandSeparator />
              <CommandGroup>
                {assignableUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => toggleAssigneeFilter(user.id)}
                  >
                    <div
                      className={cn(
                        'mr-2 flex size-4 items-center justify-center rounded-sm border',
                        selectedAssignees.includes(user.id)
                          ? 'border-zinc-700 bg-zinc-700 text-white dark:border-primary dark:bg-primary dark:text-background'
                          : 'border-muted-foreground/30'
                      )}
                    >
                      {selectedAssignees.includes(user.id) && (
                        <Check className="size-3" />
                      )}
                    </div>
                    <Avatar size="sm" className="mr-2">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {getInitials(user.name ?? user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name ?? user.email}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </FilterPopover>
      )}

      {renderBeforeOverdue}

      {/* Overdue Filter */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-8 border-dashed',
          filters.overdue && 'border-solid bg-destructive/10 border-destructive/50 text-destructive hover:bg-destructive/20 hover:text-destructive'
        )}
        onClick={() =>
          onFiltersChange({
            ...filters,
            overdue: filters.overdue ? undefined : true,
          })
        }
      >
        <Clock className="mr-2 size-3" />
        Overdue
      </Button>

      {/* Clear all filters */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-muted-foreground"
        >
          <X className="mr-1 size-3" />
          Clear filters
          <Badge variant="secondary" className="ml-1">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}

interface SelectAllItemProps {
  allIds: string[];
  selectedIds: string[];
  onToggle: () => void;
}

function SelectAllItem({ allIds, selectedIds, onToggle }: SelectAllItemProps) {
  const allSelected = allIds.length > 0 && allIds.length === selectedIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <CommandGroup>
      <CommandItem onSelect={onToggle}>
        <div
          className={cn(
            'mr-2 flex size-4 items-center justify-center rounded-sm border',
            allSelected || someSelected
              ? 'border-zinc-700 bg-zinc-700 text-white dark:border-primary dark:bg-primary dark:text-background'
              : 'border-muted-foreground/30'
          )}
        >
          {allSelected && <Check className="size-3" />}
          {someSelected && <Minus className="size-3" />}
        </div>
        <span className="font-medium">
          {allSelected ? 'Deselect all' : 'Select all'}
        </span>
      </CommandItem>
    </CommandGroup>
  );
}

interface FilterPopoverProps {
  label: string;
  selectedCount: number;
  mode?: FilterMode;
  onModeChange?: (mode: FilterMode) => void;
  onClear: () => void;
  children: React.ReactNode;
}

function FilterPopover({
  label,
  selectedCount,
  mode,
  onModeChange,
  onClear,
  children,
}: FilterPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const isNotMode = mode === 'is_not';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            selectedCount > 0 && !isNotMode && 'border-solid',
            selectedCount > 0 && isNotMode && 'border-solid border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
          )}
        >
          <Filter className="mr-2 size-3" />
          {label}
          {selectedCount > 0 && isNotMode && (
            <span className="ml-1 text-xs font-normal opacity-75">is not</span>
          )}
          {selectedCount > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-2 rounded-sm px-1',
                isNotMode && 'bg-destructive/20 text-destructive'
              )}
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        {selectedCount > 0 && onModeChange && (
          <div className="border-b px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <button
                type="button"
                onClick={() => onModeChange(isNotMode ? 'is' : 'is_not')}
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                  isNotMode
                    ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {isNotMode ? 'is not' : 'is'}
              </button>
            </div>
          </div>
        )}
        {children}
        {selectedCount > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full justify-center"
            >
              Clear filter
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function normalizeFilterValue(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.status) {
    count += Array.isArray(filters.status) ? filters.status.length : 1;
  }
  if (filters.section) {
    count += Array.isArray(filters.section) ? filters.section.length : 1;
  }
  if (filters.assigneeId) {
    count += Array.isArray(filters.assigneeId) ? filters.assigneeId.length : 1;
  }
  if (filters.overdue) {
    count += 1;
  }
  return count;
}

function getInitials(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.charAt(0).toUpperCase();
  }
  const words = nameOrEmail.split(' ').filter(Boolean);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
