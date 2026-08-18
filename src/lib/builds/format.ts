import type { BuildType } from '@/lib/actions/builds';

export interface BuildTypeMeta {
  id: BuildType;
  /** Full label for the form selector. */
  label: string;
  /** Compact label for the card badge. */
  short: string;
  /** Whether a project value is required. */
  fee: boolean;
}

export const BUILD_TYPES: BuildTypeMeta[] = [
  {
    id: 'proactive_no_fee',
    label: 'Proactive migration — no fee (absorbed by current fee)',
    short: 'Proactive · no fee',
    fee: false,
  },
  {
    id: 'proactive_with_fee',
    label: 'Proactive migration — with fee',
    short: 'Proactive · fee',
    fee: true,
  },
  {
    id: 'budgeted_project',
    label: 'Budgeted project',
    short: 'Budgeted project',
    fee: true,
  },
];

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
