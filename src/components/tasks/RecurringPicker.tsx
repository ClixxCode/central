'use client';

import * as React from 'react';
import { Repeat, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { useIgnoreWeekends } from '@/lib/hooks/useIgnoreWeekends';
import { format, parseISO, isValid, getDay } from 'date-fns';
import type { RecurringConfig } from '@/lib/db/schema/tasks';
import { getRecurringLabel, getNthWeekdayOfMonth } from '@/lib/utils/recurring';

type RecurringFrequency = RecurringConfig['frequency'];
type MonthlyPattern = 'dayOfMonth' | 'dayOfWeek';

interface FrequencyOption {
  value: RecurringFrequency;
  label: string;
  description: string;
}

const frequencyOptions: FrequencyOption[] = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'On selected days' },
  { value: 'biweekly', label: 'Biweekly', description: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Same day each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', description: 'Once a year' },
];

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayFullLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daySelectLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const weekOfMonthOptions = [
  { value: '1', label: '1st' },
  { value: '2', label: '2nd' },
  { value: '3', label: '3rd' },
  { value: '4', label: '4th' },
  { value: '-1', label: 'Last' },
  { value: '-2', label: 'Last full week' },
];

type EndType = 'never' | 'date' | 'occurrences';

/**
 * Detect which week-of-month ordinal a date falls on (1st, 2nd, 3rd, 4th, or last).
 */
function detectWeekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  const ordinal = Math.ceil(dayOfMonth / 7); // 1-based week ordinal

  // Check if this is the last occurrence of this weekday in the month
  const dayOfWeek = getDay(date);
  const lastOccurrence = getNthWeekdayOfMonth(
    date.getFullYear(),
    date.getMonth(),
    -1,
    dayOfWeek
  );
  if (date.getDate() === lastOccurrence.getDate()) {
    return -1; // It's the last occurrence
  }

  return ordinal;
}

interface RecurringPickerProps {
  value: RecurringConfig | null;
  onChange: (config: RecurringConfig | null) => void;
  disabled?: boolean;
  baseDueDate?: string | null;
}

export function RecurringPicker({
  value,
  onChange,
  disabled = false,
  baseDueDate,
}: RecurringPickerProps) {
  const ignoreWeekends = useIgnoreWeekends();
  const [open, setOpen] = React.useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = React.useState(false);

  // Internal form state
  const [frequency, setFrequency] = React.useState<RecurringFrequency>('weekly');
  const [interval, setInterval] = React.useState(1);
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>([1]); // Monday default
  const [monthlyPattern, setMonthlyPattern] = React.useState<MonthlyPattern>('dayOfMonth');
  const [weekOfMonth, setWeekOfMonth] = React.useState<number>(1);
  const [monthlyDayOfWeek, setMonthlyDayOfWeek] = React.useState<number>(1);
  const [endType, setEndType] = React.useState<EndType>('never');
  const [endDate, setEndDate] = React.useState<string | undefined>(undefined);
  const [endAfterOccurrences, setEndAfterOccurrences] = React.useState<number>(10);

  // Sync internal state from prop value when opening
  React.useEffect(() => {
    if (open && value) {
      setFrequency(value.frequency);
      setInterval(value.interval);
      setDaysOfWeek(value.daysOfWeek ?? [1]);
      setMonthlyPattern(value.monthlyPattern ?? 'dayOfMonth');
      setWeekOfMonth(value.weekOfMonth ?? 1);
      setMonthlyDayOfWeek(value.monthlyDayOfWeek ?? 1);
      if (value.endDate) {
        setEndType('date');
        setEndDate(value.endDate);
      } else if (value.endAfterOccurrences) {
        setEndType('occurrences');
        setEndAfterOccurrences(value.endAfterOccurrences);
      } else {
        setEndType('never');
      }
    } else if (open && !value) {
      // Reset to defaults when opening without a value
      setFrequency('weekly');
      setInterval(1);
      setDaysOfWeek([1]);
      setMonthlyPattern('dayOfMonth');
      setEndType('never');
      setEndDate(undefined);
      setEndAfterOccurrences(10);
      // Auto-detect from baseDueDate for monthly day-of-week defaults
      if (baseDueDate) {
        const date = parseISO(baseDueDate);
        if (isValid(date)) {
          setMonthlyDayOfWeek(getDay(date));
          setWeekOfMonth(detectWeekOfMonth(date));
        }
      } else {
        setWeekOfMonth(1);
        setMonthlyDayOfWeek(1);
      }
    }
  }, [open, value]);

  const handleSave = () => {
    const config: RecurringConfig = {
      frequency,
      interval,
    };

    if (frequency === 'weekly' || frequency === 'biweekly') {
      config.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [1];
    }

    if (frequency === 'monthly' || frequency === 'quarterly') {
      config.monthlyPattern = monthlyPattern;
      if (monthlyPattern === 'dayOfWeek') {
        config.weekOfMonth = weekOfMonth;
        config.monthlyDayOfWeek = monthlyDayOfWeek;
      } else if (baseDueDate) {
        const date = parseISO(baseDueDate);
        if (isValid(date)) {
          config.dayOfMonth = date.getDate();
        }
      }
    }

    if (endType === 'date' && endDate) {
      config.endDate = endDate;
    } else if (endType === 'occurrences') {
      config.endAfterOccurrences = endAfterOccurrences;
    }

    onChange(config);
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(null);
    setOpen(false);
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const getIntervalLabel = () => {
    switch (frequency) {
      case 'daily':
        return interval === 1 ? 'day' : 'days';
      case 'weekly':
        return interval === 1 ? 'week' : 'weeks';
      case 'biweekly':
        return interval === 1 ? 'period' : 'periods';
      case 'monthly':
        return interval === 1 ? 'month' : 'months';
      case 'quarterly':
        return interval === 1 ? 'quarter' : 'quarters';
      case 'yearly':
        return interval === 1 ? 'year' : 'years';
      default:
        return '';
    }
  };

  const showMonthlyOptions = frequency === 'monthly' || frequency === 'quarterly';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 w-full justify-start gap-1.5 font-normal bg-background',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Repeat className="size-3.5" />
          <span>{value ? getRecurringLabel(value) : 'Not recurring'}</span>
          {value && !disabled && (
            <X
              className="ml-1 size-3 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="text-sm font-medium">Repeat</div>

          {/* Frequency Select */}
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as RecurringFrequency)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Interval */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Every</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) =>
                setInterval(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))
              }
              className="h-8 w-16"
            />
            <span className="text-sm text-muted-foreground">
              {getIntervalLabel()}
            </span>
          </div>

          {/* Day Selection for Weekly/Biweekly */}
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div className="space-y-2">
              <div className="text-sm font-medium">On days</div>
              <div className="flex gap-1">
                {dayLabels.map((label, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    title={dayFullLabels[index]}
                    className={cn(
                      'flex size-8 items-center justify-center rounded text-xs font-medium transition-colors',
                      daysOfWeek.includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-accent'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly/Quarterly Pattern Selection */}
          {showMonthlyOptions && (
            <div className="space-y-2">
              <div className="text-sm font-medium">On</div>
              <Select
                value={monthlyPattern}
                onValueChange={(v) => setMonthlyPattern(v as MonthlyPattern)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dayOfMonth">Day of month</SelectItem>
                  <SelectItem value="dayOfWeek">Day of week</SelectItem>
                </SelectContent>
              </Select>

              {monthlyPattern === 'dayOfWeek' && (
                <div className="flex items-center gap-2">
                  <Select
                    value={String(weekOfMonth)}
                    onValueChange={(v) => {
                      const val = parseInt(v);
                      setWeekOfMonth(val);
                      // Last full week only supports Mon-Fri; clamp weekend selections
                      if (val === -2 && (monthlyDayOfWeek === 0 || monthlyDayOfWeek === 6)) {
                        setMonthlyDayOfWeek(1); // Default to Monday
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOfMonthOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(monthlyDayOfWeek)}
                    onValueChange={(v) => setMonthlyDayOfWeek(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daySelectLabels
                        .map((label, index) => ({ label, index }))
                        .filter(({ index }) =>
                          // Last full week: only Mon-Fri
                          weekOfMonth === -2 ? index >= 1 && index <= 5 : true
                        )
                        .map(({ label, index }) => (
                          <SelectItem key={index} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {monthlyPattern === 'dayOfMonth' && baseDueDate && (
                <p className="text-xs text-muted-foreground">
                  Based on the due date ({format(parseISO(baseDueDate), 'do')})
                </p>
              )}
            </div>
          )}

          {/* End Options */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Ends</div>
            <Select
              value={endType}
              onValueChange={(v) => setEndType(v as EndType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="date">On date</SelectItem>
                <SelectItem value="occurrences">After occurrences</SelectItem>
              </SelectContent>
            </Select>

            {endType === 'date' && (
              <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {endDate
                      ? format(parseISO(endDate), 'MMM d, yyyy')
                      : 'Select end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ? parseISO(endDate) : undefined}
                    onSelect={(date) => {
                      setEndDate(date ? format(date, 'yyyy-MM-dd') : undefined);
                      setEndDatePickerOpen(false);
                    }}
                    initialFocus
                    hideWeekends={ignoreWeekends}
                  />
                </PopoverContent>
              </Popover>
            )}

            {endType === 'occurrences' && (
              <div className="flex items-center gap-2">
                <span className="text-sm">After</span>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={endAfterOccurrences}
                  onChange={(e) =>
                    setEndAfterOccurrences(
                      Math.max(1, Math.min(999, parseInt(e.target.value) || 1))
                    )
                  }
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">occurrences</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => handleClear()}>
              Remove
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Small indicator icon showing a task is recurring
 */
interface RecurringIndicatorProps {
  className?: string;
}

export function RecurringIndicator({ className }: RecurringIndicatorProps) {
  return <Repeat className={cn('size-3.5 text-muted-foreground', className)} />;
}
