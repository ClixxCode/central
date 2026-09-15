/**
 * Which client boards belong in a rollup view.
 *
 * Rollups are the team's working view of live client work, so a terminated
 * account's board does not belong there — it was rendering exactly like an
 * active one, because account_status was synced from Pulse and displayed as a
 * badge but never used as a filter anywhere.
 *
 * DENY-list, deliberately, and this is the opposite call from the portal's
 * module gate. There the risk of a wrong default is a client seeing data they
 * should not, so the gate allow-lists. Here the risk is a LIVE board silently
 * vanishing from the team's view, which is far worse than a stale one
 * lingering — so anything not explicitly terminated is shown. That matters
 * concretely: seven Central clients (including Clix's own internal boards)
 * have a null account_status because they were never synced from Pulse, and
 * an allow-list would hide every one of them.
 *
 * Statuses come from ops.accounts.account_status via the Pulse account-sync
 * webhook; Pulse's own active book (src/lib/kpi.ts ACTIVE_ACCOUNT_STATUSES)
 * likewise excludes only pipeline and terminated from the working set.
 */
export const HIDDEN_ROLLUP_ACCOUNT_STATUSES = ["terminated"] as const

export function isHiddenRollupAccountStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false
  return (HIDDEN_ROLLUP_ACCOUNT_STATUSES as readonly string[]).includes(
    status.trim().toLowerCase(),
  )
}

/** Drop sources whose client is terminated. Shape-agnostic on purpose. */
export function filterActiveRollupSources<
  T extends { sourceBoard?: { client?: { accountStatus?: string | null } | null } | null },
>(sources: T[]): T[] {
  return sources.filter(
    (s) => !isHiddenRollupAccountStatus(s.sourceBoard?.client?.accountStatus),
  )
}
