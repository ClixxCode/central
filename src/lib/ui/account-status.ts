// Shared presentation helpers for Pulse-reflected account context (status pill
// + team avatars). Used by BoardHeader and the rollup group headers so the two
// surfaces stay visually consistent.

// Lifecycle status → pill styling. Falls back to neutral for unknown values.
export const ACCOUNT_STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  onboarding: 'bg-blue-100 text-blue-800 border-blue-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  offboarding: 'bg-orange-100 text-orange-800 border-orange-200',
  terminated: 'bg-gray-100 text-gray-500 border-gray-200',
  pipeline: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function accountTitleCase(s: string): string {
  return s.replace(/(^|_)([a-z])/g, (_, p, c) => (p ? ' ' : '') + c.toUpperCase());
}

// Base URL for the Pulse operations app. The account profile lives at
// `${PULSE_BASE_URL}/accounts/${pulseAccountId}`.
export const PULSE_BASE_URL =
  process.env.NEXT_PUBLIC_PULSE_URL ?? 'https://pulse.clix.co';

export function accountInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
