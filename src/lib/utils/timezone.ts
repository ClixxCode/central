const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Returns YYYY-MM-DD for "today" in the given IANA timezone.
 */
export function getOrgToday(timezone: string | null | undefined): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD for "tomorrow" in the given IANA timezone.
 */
export function getOrgTomorrow(timezone: string | null | undefined): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(tomorrow);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD for a date `daysAgo` days in the past, in the given IANA timezone.
 * Used for auto-archive cutoff calculation.
 */
export function getOrgCutoffDate(timezone: string | null | undefined, daysAgo: number): Date {
  const todayStr = getOrgToday(timezone);
  const date = new Date(todayStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}
