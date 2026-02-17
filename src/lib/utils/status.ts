import type { StatusOption } from '@/lib/db/schema';

/**
 * Determine if a status ID represents a "complete" or "done" status.
 */
export function isCompleteStatus(
  statusId: string,
  statusOptions: StatusOption[]
): boolean {
  const option = statusOptions.find((s) => s.id === statusId);
  if (!option) return false;
  return (
    option.id === 'complete' ||
    option.id === 'done' ||
    option.label.toLowerCase().includes('complete') ||
    option.label.toLowerCase().includes('done')
  );
}

/**
 * Get all status IDs that represent "complete" or "done".
 */
export function getCompleteStatusIds(statusOptions: StatusOption[]): string[] {
  return statusOptions
    .filter(
      (s) =>
        s.id === 'complete' ||
        s.id === 'done' ||
        s.label.toLowerCase().includes('complete') ||
        s.label.toLowerCase().includes('done')
    )
    .map((s) => s.id);
}
