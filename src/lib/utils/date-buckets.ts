import { format, endOfWeek, addWeeks } from 'date-fns';

export interface DateBucket {
  id: string;
  label: string;
  color: string;
}

const DATE_BUCKET_COLORS: Record<string, string> = {
  overdue: '#ef4444',   // red-500
  today: '#3b82f6',     // blue-500
  tomorrow: '#8b5cf6',  // violet-500
  'this-week': '#10b981', // emerald-500
  'next-week': '#f59e0b', // amber-500
  later: '#6b7280',     // gray-500
  'no-date': '#9ca3af', // gray-400
};

/**
 * Get date bucket definitions with today's computed labels.
 */
export function getDateBucketDefinitions(): DateBucket[] {
  const now = new Date();
  const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return [
    { id: 'overdue', label: 'Overdue', color: DATE_BUCKET_COLORS.overdue },
    { id: 'today', label: `Today — ${format(now, 'MMM d')}`, color: DATE_BUCKET_COLORS.today },
    { id: 'tomorrow', label: `Tomorrow — ${format(tomorrowDate, 'MMM d')}`, color: DATE_BUCKET_COLORS.tomorrow },
    { id: 'this-week', label: 'This Week', color: DATE_BUCKET_COLORS['this-week'] },
    { id: 'next-week', label: 'Next Week', color: DATE_BUCKET_COLORS['next-week'] },
    { id: 'later', label: 'Later', color: DATE_BUCKET_COLORS.later },
    { id: 'no-date', label: 'No Date', color: DATE_BUCKET_COLORS['no-date'] },
  ];
}

/**
 * Assign a task to a date bucket based on its dueDate string (YYYY-MM-DD or null).
 */
export function getDateBucketId(dueDate: string | null): string {
  if (!dueDate) return 'no-date';

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextWeekEnd = format(endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  if (dueDate < todayStr) return 'overdue';
  if (dueDate === todayStr) return 'today';
  if (dueDate === tomorrowStr) return 'tomorrow';
  if (dueDate <= weekEnd) return 'this-week';
  if (dueDate <= nextWeekEnd) return 'next-week';
  return 'later';
}

/**
 * Group items by date bucket. Returns a record of bucketId → items.
 * Items are sorted by dueDate asc within each bucket, with null dates last.
 */
export function groupByDateBucket<T extends { dueDate: string | null; position: number }>(
  items: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    'this-week': [],
    'next-week': [],
    later: [],
    'no-date': [],
  };

  items.forEach((item) => {
    const bucketId = getDateBucketId(item.dueDate);
    grouped[bucketId].push(item);
  });

  // Sort within each bucket
  Object.values(grouped).forEach((bucketItems) => {
    bucketItems.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const cmp = a.dueDate.localeCompare(b.dueDate);
        if (cmp !== 0) return cmp;
      }
      return a.position - b.position;
    });
  });

  return grouped;
}
