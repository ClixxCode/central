import type { BuildType } from '@/lib/actions/builds';

export interface BuildTypeMeta {
  id: BuildType;
  /** Full label for the form selector. */
  label: string;
  /** Compact label for the card badge. */
  short: string;
  /** Whether a project value is required. */
  fee: boolean;
  /** Left-border accent hex — colour tracks type by salience: least→most
   *  noticeable = least→most important (no-fee < with-fee < budgeted). */
  accent: string;
  /** Tailwind classes for the type pill (light + dark). */
  badgeClass: string;
}

// Salience ramp (quiet → loud): slate < blue < amber. Colour = attention, and
// importance runs budgeted project > proactive w/ fee > proactive no fee.
export const BUILD_TYPES: BuildTypeMeta[] = [
  {
    id: 'proactive_no_fee',
    label: 'Proactive migration — no fee (absorbed by current fee)',
    short: 'Proactive · no fee',
    fee: false,
    accent: '#94a3b8', // slate-400 — quietest
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    id: 'proactive_with_fee',
    label: 'Proactive migration — with fee',
    short: 'Proactive · fee',
    fee: true,
    accent: '#3b82f6', // blue-500 — mid
    badgeClass:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  },
  {
    id: 'budgeted_project',
    label: 'Budgeted project',
    short: 'Budgeted project',
    fee: true,
    accent: '#f59e0b', // amber-500 — loudest / most important
    badgeClass:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  },
];

/** Left-border accent for a card. Untyped builds get a muted neutral so only
 *  classified cards carry colour meaning. */
export const BUILD_UNTYPED_ACCENT = '#cbd5e1'; // slate-300

export function buildAccentColor(id: BuildType | null | undefined): string {
  return buildTypeMeta(id)?.accent ?? BUILD_UNTYPED_ACCENT;
}

export function buildTypeMeta(id: BuildType | null | undefined): BuildTypeMeta | undefined {
  return id ? BUILD_TYPES.find((t) => t.id === id) : undefined;
}

export function buildTypeIsFee(id: BuildType | null | undefined): boolean {
  return !!buildTypeMeta(id)?.fee;
}

/** Compact human duration from milliseconds: "<1h", "6h", "12d", "3w", "2mo". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return '—';
  const hours = ms / 3_600_000;
  if (hours < 1) return '<1h';
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 21) return `${Math.round(days)}d`;
  const weeks = days / 7;
  if (weeks < 9) return `${Math.round(weeks)}w`;
  return `${Math.round(days / 30)}mo`;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
