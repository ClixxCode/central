'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusSelect } from './StatusSelect';
import { SectionSelect } from './SectionSelect';
import { AssigneePicker, type AssigneeUser } from './AssigneePicker';
import { TaskDatePicker } from './DatePicker';
import type { CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

interface NewTaskRowProps {
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onCreateTask: (input: Omit<CreateTaskInput, 'boardId'>) => void;
  isCreating?: boolean;
  defaultStatus?: string;
  columns: {
    title: boolean;
    status: boolean;
    section: boolean;
    assignees: boolean;
    dueDate: boolean;
  };
}

export function NewTaskRow({
  statusOptions,
  sectionOptions,
  assignableUsers,
  onCreateTask,
  isCreating = false,
  defaultStatus,
  columns,
}: NewTaskRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState(defaultStatus ?? statusOptions[0]?.id ?? 'todo');
  const [section, setSection] = React.useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState<string | null>(null);
  const [dateFlexibility, setDateFlexibility] = React.useState<DateFlexibility>('not_set');

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const resetForm = () => {
    setTitle('');
    setStatus(defaultStatus ?? statusOptions[0]?.id ?? 'todo');
    setSection(null);
    setAssigneeIds([]);
    setDueDate(null);
    setDateFlexibility('not_set');
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onCreateTask({
      title: trimmedTitle,
      status,
      section: section ?? undefined,
      assigneeIds,
      dueDate: dueDate ?? undefined,
      dateFlexibility,
    });

    resetForm();
    // Keep expanded for quick successive adds
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      resetForm();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is within the row
    const currentTarget = e.currentTarget;
    // Give a moment for the new focus to be set
    requestAnimationFrame(() => {
      if (!currentTarget.contains(document.activeElement)) {
        if (!title.trim()) {
          setIsExpanded(false);
          resetForm();
        }
      }
    });
  };

  if (!isExpanded) {
    return (
      <tr>
        <td colSpan={Object.values(columns).filter(Boolean).length + 1} className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="mr-1 size-4" />
            Add task
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={cn(
        'border-b bg-muted/30',
        isCreating && 'opacity-50 pointer-events-none'
      )}
      onBlur={handleBlur}
    >
      {/* Title Column */}
      {columns.title && (
        <td className="px-3 py-2">
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title..."
            className="h-7 text-sm"
          />
        </td>
      )}

      {/* Status Column */}
      {columns.status && (
        <td className="px-3 py-2">
          <StatusSelect
            value={status}
            onChange={setStatus}
            options={statusOptions}
            size="sm"
          />
        </td>
      )}

      {/* Section Column */}
      {columns.section && (
        <td className="px-3 py-2">
          <SectionSelect
            value={section}
            onChange={setSection}
            options={sectionOptions}
          />
        </td>
      )}

      {/* Assignees Column */}
      {columns.assignees && (
        <td className="px-3 py-2">
          <AssigneePicker
            value={assigneeIds}
            onChange={setAssigneeIds}
            users={assignableUsers}
          />
        </td>
      )}

      {/* Due Date Column */}
      {columns.dueDate && (
        <td className="px-3 py-2">
          <TaskDatePicker
            date={dueDate}
            onDateChange={setDueDate}
            flexibility={dateFlexibility}
            onFlexibilityChange={setDateFlexibility}
          />
        </td>
      )}

      {/* Actions Column */}
      <td className="px-3 py-2 w-12">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={handleSubmit}
            disabled={!title.trim() || isCreating}
            className="h-7 px-2"
          >
            Add
          </Button>
        </div>
      </td>
    </tr>
  );
}
