import { inArray, isNull } from 'drizzle-orm';
import { tasks } from '@/lib/db/schema';

/**
 * Base conditions shared by every active rollup task query.
 */
export function buildActiveRollupTaskConditions(sourceBoardIds: string[]) {
  return [
    inArray(tasks.boardId, sourceBoardIds),
    isNull(tasks.parentTaskId),
    isNull(tasks.archivedAt),
  ];
}
