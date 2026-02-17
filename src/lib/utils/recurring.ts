import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  setDate,
  lastDayOfMonth,
  isAfter,
  isBefore,
  parseISO,
  format,
  getDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { RecurringConfig } from '@/lib/db/schema/tasks';

/**
 * Calculate the next occurrence date based on recurring configuration.
 *
 * @param config - The recurring configuration
 * @param currentDueDate - The current/last due date (ISO string YYYY-MM-DD)
 * @param completionDate - Optional date when task was completed (defaults to today)
 * @returns The next due date as ISO string, or null if series has ended
 */
export function calculateNextOccurrence(
  config: RecurringConfig,
  currentDueDate: string,
  completionDate?: Date
): string | null {
  const current = parseISO(currentDueDate);
  const today = startOfDay(completionDate ?? new Date());

  // If end date is set and we've passed it, return null
  if (config.endDate) {
    const endDate = parseISO(config.endDate);
    if (isAfter(today, endDate)) {
      return null;
    }
  }

  let nextDate: Date;

  switch (config.frequency) {
    case 'daily':
      nextDate = addDays(current, config.interval);
      break;

    case 'weekly':
      nextDate = calculateNextWeeklyOccurrence(
        current,
        config.daysOfWeek ?? [],
        config.interval
      );
      break;

    case 'biweekly':
      // Biweekly = every 2 weeks on selected days
      nextDate = calculateNextWeeklyOccurrence(
        current,
        config.daysOfWeek ?? [],
        config.interval * 2
      );
      break;

    case 'monthly':
      nextDate = calculateNextMonthlyForConfig(current, config, config.interval);
      break;

    case 'quarterly':
      nextDate = calculateNextMonthlyForConfig(current, config, config.interval * 3);
      break;

    case 'yearly':
      nextDate = addYears(current, config.interval);
      break;

    default:
      return null;
  }

  // If next date is in the past (task was overdue), advance to future
  while (isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) {
    nextDate = advanceByInterval(nextDate, config);
  }

  // Check if we've exceeded end date after advancing
  if (config.endDate) {
    const endDate = parseISO(config.endDate);
    if (isAfter(nextDate, endDate)) {
      return null;
    }
  }

  return format(nextDate, 'yyyy-MM-dd');
}

/**
 * Advance a date by the recurring interval
 */
function advanceByInterval(date: Date, config: RecurringConfig): Date {
  switch (config.frequency) {
    case 'daily':
      return addDays(date, config.interval);
    case 'weekly':
      return calculateNextWeeklyOccurrence(
        date,
        config.daysOfWeek ?? [],
        config.interval
      );
    case 'biweekly':
      return calculateNextWeeklyOccurrence(
        date,
        config.daysOfWeek ?? [],
        config.interval * 2
      );
    case 'monthly':
      return calculateNextMonthlyForConfig(date, config, config.interval);
    case 'quarterly':
      return calculateNextMonthlyForConfig(date, config, config.interval * 3);
    case 'yearly':
      return addYears(date, config.interval);
    default:
      return addDays(date, 1);
  }
}

/**
 * Route monthly/quarterly calculation based on monthlyPattern.
 */
function calculateNextMonthlyForConfig(
  current: Date,
  config: RecurringConfig,
  monthInterval: number
): Date {
  if (
    config.monthlyPattern === 'dayOfWeek' &&
    config.weekOfMonth !== undefined &&
    config.monthlyDayOfWeek !== undefined
  ) {
    return calculateNextMonthlyDayOfWeekOccurrence(
      current,
      config.weekOfMonth,
      config.monthlyDayOfWeek,
      monthInterval
    );
  }
  return calculateNextMonthlyOccurrence(
    current,
    config.dayOfMonth ?? current.getDate(),
    monthInterval
  );
}

/**
 * Calculate next weekly occurrence considering multiple days of week.
 */
function calculateNextWeeklyOccurrence(
  current: Date,
  daysOfWeek: number[],
  weekInterval: number
): Date {
  if (daysOfWeek.length === 0) {
    // Default to same day of week
    return addWeeks(current, weekInterval);
  }

  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
  const currentDayOfWeek = getDay(current);

  // Find next day in current week (after current day)
  const nextDayThisWeek = sortedDays.find((d) => d > currentDayOfWeek);

  if (nextDayThisWeek !== undefined) {
    // Next occurrence is later this week
    return addDays(current, nextDayThisWeek - currentDayOfWeek);
  }

  // Next occurrence is in the next interval period, on the first selected day
  const daysUntilEndOfWeek = 7 - currentDayOfWeek;
  const daysIntoNextPeriod = sortedDays[0];
  const weeksToAdd = weekInterval - 1; // -1 because we're already moving to next week

  return addDays(current, daysUntilEndOfWeek + weeksToAdd * 7 + daysIntoNextPeriod);
}

/**
 * Calculate next monthly occurrence, handling end-of-month edge cases.
 */
function calculateNextMonthlyOccurrence(
  current: Date,
  targetDay: number,
  monthInterval: number
): Date {
  const nextMonth = addMonths(current, monthInterval);
  const lastDay = lastDayOfMonth(nextMonth).getDate();

  // If target day exceeds month length, use last day
  const actualDay = Math.min(targetDay, lastDay);

  return setDate(nextMonth, actualDay);
}

/**
 * Calculate the nth weekday of a given month/year.
 * @param year - Full year
 * @param month - 0-indexed month (0 = January)
 * @param weekOfMonth - 1-4 for nth occurrence, -1 for last
 * @param dayOfWeek - 0-6 (Sunday-Saturday)
 * @returns The date of the nth weekday in that month
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekOfMonth: number,
  dayOfWeek: number
): Date {
  if (weekOfMonth === -1) {
    // Find the last occurrence: start from last day of month, walk backwards
    const last = lastDayOfMonth(new Date(year, month, 1));
    let d = last;
    while (getDay(d) !== dayOfWeek) {
      d = addDays(d, -1);
    }
    return d;
  }

  // Find the nth occurrence: start from first of month
  const first = startOfMonth(new Date(year, month, 1));
  let d = first;
  // Advance to the first occurrence of dayOfWeek
  while (getDay(d) !== dayOfWeek) {
    d = addDays(d, 1);
  }
  // Now d is the 1st occurrence; advance (weekOfMonth - 1) weeks
  d = addWeeks(d, weekOfMonth - 1);
  return d;
}

/**
 * Calculate next monthly day-of-week occurrence.
 * E.g., "last Tuesday" or "2nd Friday" of the month.
 */
function calculateNextMonthlyDayOfWeekOccurrence(
  current: Date,
  weekOfMonth: number,
  dayOfWeek: number,
  monthInterval: number
): Date {
  const nextMonth = addMonths(current, monthInterval);
  return getNthWeekdayOfMonth(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    weekOfMonth,
    dayOfWeek
  );
}

/**
 * Check if a recurring series should generate more occurrences.
 */
export function shouldGenerateNextOccurrence(
  config: RecurringConfig,
  currentOccurrenceCount: number
): boolean {
  // Check occurrence limit
  if (config.endAfterOccurrences) {
    if (currentOccurrenceCount >= config.endAfterOccurrences) {
      return false;
    }
  }

  // Check end date
  if (config.endDate) {
    const endDate = parseISO(config.endDate);
    const today = startOfDay(new Date());
    if (isAfter(today, endDate)) {
      return false;
    }
  }

  return true;
}

/**
 * Get a human-readable description of the recurrence pattern.
 */
export function getRecurrenceDescription(config: RecurringConfig): string {
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let description = '';

  switch (config.frequency) {
    case 'daily':
      description =
        config.interval === 1 ? 'Every day' : `Every ${config.interval} days`;
      break;

    case 'weekly':
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        const days = config.daysOfWeek.map((d) => shortDayNames[d]).join(', ');
        description =
          config.interval === 1
            ? `Weekly on ${days}`
            : `Every ${config.interval} weeks on ${days}`;
      } else {
        description =
          config.interval === 1 ? 'Weekly' : `Every ${config.interval} weeks`;
      }
      break;

    case 'biweekly':
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        const days = config.daysOfWeek.map((d) => shortDayNames[d]).join(', ');
        description = `Every 2 weeks on ${days}`;
      } else {
        description = 'Every 2 weeks';
      }
      break;

    case 'monthly': {
      const monthlyDesc = getMonthlyDescription(config, dayNames);
      if (monthlyDesc) {
        description =
          config.interval === 1
            ? `Monthly on the ${monthlyDesc}`
            : `Every ${config.interval} months on the ${monthlyDesc}`;
      } else {
        description =
          config.interval === 1 ? 'Monthly' : `Every ${config.interval} months`;
      }
      break;
    }

    case 'quarterly': {
      const quarterlyDesc = getMonthlyDescription(config, dayNames);
      if (quarterlyDesc) {
        description =
          config.interval === 1
            ? `Quarterly on the ${quarterlyDesc}`
            : `Every ${config.interval} quarters on the ${quarterlyDesc}`;
      } else {
        description =
          config.interval === 1
            ? 'Quarterly'
            : `Every ${config.interval} quarters`;
      }
      break;
    }

    case 'yearly':
      description =
        config.interval === 1 ? 'Yearly' : `Every ${config.interval} years`;
      break;
  }

  // Add end condition
  if (config.endDate) {
    description += ` until ${format(parseISO(config.endDate), 'MMM d, yyyy')}`;
  } else if (config.endAfterOccurrences) {
    description += `, ${config.endAfterOccurrences} times`;
  }

  return description;
}

/**
 * Get the monthly pattern description portion (e.g., "15th" or "last Tuesday").
 */
function getMonthlyDescription(
  config: RecurringConfig,
  dayNames: string[]
): string | null {
  if (
    config.monthlyPattern === 'dayOfWeek' &&
    config.weekOfMonth !== undefined &&
    config.monthlyDayOfWeek !== undefined
  ) {
    const weekLabel = getWeekOfMonthLabel(config.weekOfMonth);
    return `${weekLabel} ${dayNames[config.monthlyDayOfWeek]}`;
  }
  if (config.dayOfMonth) {
    const suffix = getOrdinalSuffix(config.dayOfMonth);
    return `${config.dayOfMonth}${suffix}`;
  }
  return null;
}

/**
 * Get human-readable label for weekOfMonth value.
 */
function getWeekOfMonthLabel(weekOfMonth: number): string {
  switch (weekOfMonth) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    case 4: return '4th';
    case -1: return 'last';
    default: return `${weekOfMonth}th`;
  }
}

/**
 * Get a short label for the recurring frequency
 */
export function getRecurringLabel(config: RecurringConfig): string {
  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const labels: Record<RecurringConfig['frequency'], string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };

  let label = labels[config.frequency];

  if (config.interval > 1) {
    switch (config.frequency) {
      case 'daily':
        label = `Every ${config.interval} days`;
        break;
      case 'weekly':
        label = `Every ${config.interval} weeks`;
        break;
      case 'monthly':
        label = `Every ${config.interval} months`;
        break;
      case 'yearly':
        label = `Every ${config.interval} years`;
        break;
    }
  }

  // Append day-of-week pattern for monthly/quarterly
  if (
    (config.frequency === 'monthly' || config.frequency === 'quarterly') &&
    config.monthlyPattern === 'dayOfWeek' &&
    config.weekOfMonth !== undefined &&
    config.monthlyDayOfWeek !== undefined
  ) {
    const weekLabel = getWeekOfMonthLabel(config.weekOfMonth);
    label += ` on ${weekLabel} ${shortDayNames[config.monthlyDayOfWeek]}`;
  }

  return label;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
