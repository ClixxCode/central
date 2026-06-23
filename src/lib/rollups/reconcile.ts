import 'server-only';
import { sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { boards } from '@/lib/db/schema';
import type { RollupRule } from '@/lib/db/schema';

/**
 * Rule-based rollup membership.
 *
 * Rollup boards are no longer hand-curated: their member (source) boards are
 * derived from Pulse-reflected client attributes — pod, assignment, lifecycle —
 * and reconciled automatically whenever those change (Pulse → Central). The
 * only management surface is pod + assignment in Pulse.
 */

// Pod and per-person rollups are "who's actively working on what" views, so
// they only surface live accounts. Lifecycle rollups (e.g. Offboarding) pick
// their own statuses explicitly and are NOT subject to this filter.
const LIVE_ACCOUNT_STATUSES = ['active', 'onboarding', 'offboarding', 'paused'];

/** SQL fragment selecting matching standard board ids (column `id`) for a rule. */
function membershipSelect(rule: RollupRule) {
  const base = sql`select b.id as id from boards b join clients c on c.id = b.client_id where b.type = 'standard'`;
  // Restrict pod/assignment membership to live accounts. NULL status is
  // excluded (unlinked clients shouldn't appear in a pod/person rollup).
  const liveOnly = sql`and c.account_status = any(${LIVE_ACCOUNT_STATUSES})`;
  switch (rule.type) {
    case 'pod':
      return sql`${base} and c.pod_name = ${rule.pod_name} ${liveOnly}`;
    case 'lifecycle':
      return sql`${base} and c.account_status = any(${rule.statuses})`;
    case 'assignment': {
      // Containment match against the reflected account team. Optionally scope
      // by group (management = AM/BD, delivery = strategists).
      const probe = rule.role
        ? JSON.stringify([{ staff_id: rule.staff_id, group: rule.role }])
        : JSON.stringify([{ staff_id: rule.staff_id }]);
      return sql`${base} and c.account_team @> ${probe}::jsonb ${liveOnly}`;
    }
  }
}

/** Recompute one rollup's `rollup_sources` from its rule. No-op for manual/legacy rollups. */
export async function reconcileRollup(rollupBoardId: string): Promise<void> {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, rollupBoardId),
    columns: { id: true, type: true, rollupRule: true },
  });
  if (!board || board.type !== 'rollup' || !board.rollupRule) return;

  const member = membershipSelect(board.rollupRule as RollupRule);

  // Drop members that no longer match, add new matches. Idempotent.
  await db.execute(sql`
    delete from rollup_sources
    where rollup_board_id = ${rollupBoardId}
      and source_board_id not in (${member})
  `);
  await db.execute(sql`
    insert into rollup_sources (rollup_board_id, source_board_id)
    select ${rollupBoardId}, m.id from (${member}) m
    on conflict (rollup_board_id, source_board_id) do nothing
  `);
}

/** Reconcile every rule-based rollup. Called from the Pulse account-updated webhook. */
export async function reconcileAllRollups(): Promise<void> {
  const rollups = await db.query.boards.findMany({
    where: (b, { and, eq, isNotNull }) => and(eq(b.type, 'rollup'), isNotNull(b.rollupRule)),
    columns: { id: true },
  });
  for (const r of rollups) {
    try {
      await reconcileRollup(r.id);
    } catch (err) {
      console.error('[rollup-reconcile] failed for', r.id, err);
    }
  }
}
