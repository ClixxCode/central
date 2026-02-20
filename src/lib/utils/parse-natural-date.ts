import {
  addDays,
  addWeeks,
  addMonths,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  startOfDay,
  format,
  parse,
  isValid,
  isBefore,
  isWeekend,
} from 'date-fns';

export interface ParsedDate {
  date: Date;
  label: string;
}

const DAY_PARSERS: Record<string, (ref: Date) => Date> = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
  mon: nextMonday,
  tue: nextTuesday,
  wed: nextWednesday,
  thu: nextThursday,
  fri: nextFriday,
  sat: nextSaturday,
  sun: nextSunday,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseNaturalDate(input: string): ParsedDate | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const today = startOfDay(new Date());

  // Keywords
  if (text === 'today') {
    return { date: today, label: 'Today' };
  }
  if (text === 'tomorrow' || text === 'tmrw') {
    return { date: addDays(today, 1), label: 'Tomorrow' };
  }
  if (text === 'next week') {
    return { date: nextMonday(today), label: 'Next week' };
  }
  if (text === 'next month') {
    return { date: addMonths(today, 1), label: 'Next month' };
  }

  // "next <day>" - e.g. "next tuesday"
  const nextDayMatch = text.match(/^next\s+(\w+)$/);
  if (nextDayMatch) {
    const dayFn = DAY_PARSERS[nextDayMatch[1]];
    if (dayFn) {
      const date = dayFn(today);
      return { date, label: format(date, 'EEE, MMM d') };
    }
  }

  // "this <day>" - same as next day
  const thisDayMatch = text.match(/^this\s+(\w+)$/);
  if (thisDayMatch) {
    const dayFn = DAY_PARSERS[thisDayMatch[1]];
    if (dayFn) {
      const date = dayFn(today);
      return { date, label: format(date, 'EEE, MMM d') };
    }
  }

  // Bare day name - "monday", "friday"
  if (DAY_PARSERS[text]) {
    const date = DAY_PARSERS[text](today);
    return { date, label: format(date, 'EEE, MMM d') };
  }

  // "in X days/weeks/months"
  const relativeMatch = text.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/);
  if (relativeMatch) {
    const n = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    let date: Date;
    if (unit.startsWith('day')) {
      date = addDays(today, n);
    } else if (unit.startsWith('week')) {
      date = addWeeks(today, n);
    } else {
      date = addMonths(today, n);
    }
    return { date, label: format(date, 'EEE, MMM d') };
  }

  // "jan 15", "february 3"
  const monthDayMatch = text.match(/^(\w+)\s+(\d{1,2})$/);
  if (monthDayMatch) {
    const month = MONTH_MAP[monthDayMatch[1]];
    if (month !== undefined) {
      const day = parseInt(monthDayMatch[2], 10);
      let date = new Date(today.getFullYear(), month, day);
      if (isBefore(date, today)) {
        date = new Date(today.getFullYear() + 1, month, day);
      }
      if (isValid(date)) {
        return { date: startOfDay(date), label: format(date, 'MMM d, yyyy') };
      }
    }
  }

  // "1/15" or "01/15"
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    let date = new Date(today.getFullYear(), month, day);
    if (isBefore(date, today)) {
      date = new Date(today.getFullYear() + 1, month, day);
    }
    if (isValid(date)) {
      return { date: startOfDay(date), label: format(date, 'MMM d, yyyy') };
    }
  }

  // "1/15/2025" or "01/15/2025"
  const fullSlashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullSlashMatch) {
    const month = parseInt(fullSlashMatch[1], 10) - 1;
    const day = parseInt(fullSlashMatch[2], 10);
    const year = parseInt(fullSlashMatch[3], 10);
    const date = new Date(year, month, day);
    if (isValid(date)) {
      return { date: startOfDay(date), label: format(date, 'MMM d, yyyy') };
    }
  }

  return null;
}

export interface DateSuggestion {
  date: Date;
  label: string;
  shortLabel: string;
}

function skipToWeekday(date: Date): Date {
  if (isWeekend(date)) {
    return nextMonday(date);
  }
  return date;
}

export function getDateSuggestions(ignoreWeekends?: boolean): DateSuggestion[] {
  const today = startOfDay(new Date());
  const suggestions: DateSuggestion[] = [
    { date: today, label: 'Today', shortLabel: 'Today' },
    { date: addDays(today, 1), label: 'Tomorrow', shortLabel: 'Tomorrow' },
    { date: nextMonday(today), label: format(nextMonday(today), "'Next' EEEE"), shortLabel: 'Next Mon' },
    { date: addWeeks(today, 1), label: 'In 1 week', shortLabel: '1 week' },
    { date: addWeeks(today, 2), label: 'In 2 weeks', shortLabel: '2 weeks' },
    { date: addMonths(today, 1), label: 'Next month', shortLabel: 'Next month' },
  ];

  if (!ignoreWeekends) return suggestions;

  // Apply skipToWeekday and deduplicate by date
  const seen = new Set<number>();
  return suggestions.reduce<DateSuggestion[]>((acc, s) => {
    const adjusted = skipToWeekday(s.date);
    const key = adjusted.getTime();
    if (!seen.has(key)) {
      seen.add(key);
      acc.push({ ...s, date: adjusted });
    }
    return acc;
  }, []);
}
