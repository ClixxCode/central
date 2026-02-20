'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useIgnoreWeekends } from '@/lib/hooks/useIgnoreWeekends';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  FlexibilityIndicator,
  FlexibilitySelect,
  getFlexibilityColor,
} from './FlexibilitySelect';
import { RecurringPicker, RecurringIndicator } from './RecurringPicker';
import type { RecurringConfig } from '@/lib/db/schema/tasks';

type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

interface TaskDatePickerProps {
  date: string | null;
  onDateChange: (date: string | null) => void;
  flexibility: DateFlexibility;
  onFlexibilityChange: (flexibility: DateFlexibility) => void;
  recurringConfig?: RecurringConfig | null;
  onRecurringChange?: (config: RecurringConfig | null) => void;
  disabled?: boolean;
  placeholder?: string;
  showFlexibility?: boolean;
  showRecurring?: boolean;
}

export function TaskDatePicker({
  date,
  onDateChange,
  flexibility,
  onFlexibilityChange,
  recurringConfig,
  onRecurringChange,
  disabled = false,
  placeholder = 'Set due date',
  showFlexibility = true,
  showRecurring = false,
}: TaskDatePickerProps) {
  const ignoreWeekends = useIgnoreWeekends();
  const [open, setOpen] = React.useState(false);
  const parsedDate = date ? parseISO(date) : undefined;
  const isDateValid = parsedDate && isValid(parsedDate);

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      // Format as YYYY-MM-DD for storage
      onDateChange(format(newDate, 'yyyy-MM-dd'));
    } else {
      onDateChange(null);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateChange(null);
    onFlexibilityChange('not_set');
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-auto justify-start gap-1.5 px-2 py-1 font-normal',
              !isDateValid && 'text-muted-foreground',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {showFlexibility && flexibility !== 'not_set' && isDateValid && (
              <FlexibilityIndicator flexibility={flexibility} />
            )}
            {!showFlexibility && <CalendarIcon className="size-3.5" />}
            {isDateValid ? (
              <span className={cn(isOverdue(parsedDate!) && 'text-destructive')}>
                {formatDateDisplay(parsedDate!)}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
            {isDateValid && !disabled && (
              <X
                className="ml-1 size-3 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={isDateValid ? parsedDate : undefined}
            defaultMonth={isDateValid ? parsedDate : undefined}
            onSelect={handleSelect}
            initialFocus
            hideWeekends={ignoreWeekends}
          />
          {showFlexibility && (
            <div className="border-t p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Date flexibility
              </div>
              <FlexibilitySelect
                value={flexibility}
                onChange={onFlexibilityChange}
                showLabel
              />
            </div>
          )}
          {showRecurring && onRecurringChange && (
            <div className="border-t p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Repeat
              </div>
              <RecurringPicker
                value={recurringConfig ?? null}
                onChange={onRecurringChange}
                baseDueDate={date}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DateDisplayProps {
  date: string | null;
  flexibility?: DateFlexibility;
  showFlexibility?: boolean;
  className?: string;
}

export function DateDisplay({
  date,
  flexibility = 'not_set',
  showFlexibility = true,
  className,
}: DateDisplayProps) {
  if (!date) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        No due date
      </span>
    );
  }

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        Invalid date
      </span>
    );
  }

  const overdue = isOverdue(parsedDate);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        overdue && 'text-destructive',
        className
      )}
    >
      {showFlexibility && flexibility !== 'not_set' && (
        <FlexibilityIndicator flexibility={flexibility} />
      )}
      {formatDateDisplay(parsedDate)}
    </span>
  );
}

function formatDateDisplay(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Tomorrow';
  }

  if (diffDays === -1) {
    return 'Yesterday';
  }

  // If within this week (next 7 days), show day name
  if (diffDays > 0 && diffDays <= 7) {
    return format(date, 'EEEE'); // e.g., "Wednesday"
  }

  // If within this year, show month and day
  if (date.getFullYear() === today.getFullYear()) {
    return format(date, 'MMM d'); // e.g., "Jan 15"
  }

  // Otherwise, show full date
  return format(date, 'MMM d, yyyy'); // e.g., "Jan 15, 2025"
}

function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate < today;
}

export function getDaysUntilDue(date: string | null): number | null {
  if (!date) return null;

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(parsedDate);
  targetDate.setHours(0, 0, 0, 0);

  return Math.floor(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}
