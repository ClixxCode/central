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

/**
 * Whether the client has paid delivery work, derived in PULSE from billing
 * (ops.account_has_delivery_work) and synced on the account snapshot.
 *
 * This is the field the pod_sub_context attempt should have used. A rollup is
 * a delivery board, so what belongs on it is "are we paid to deliver
 * something" — and the only system that knows is the one holding the
 * invoices. Recurring or Project billing in the last 120 days is true;
 * hosting, maintenance, card fees and domain renewals alone are false.
 *
 * Read as an explicit `=== false`, not as falsy. A client row predating the
 * column, or one Pulse has not synced, must SHOW — same posture as the
 * terminated rule below, where hiding a live board is the expensive mistake.
 */
export function isHiddenRollupDeliveryState(
  hasDeliveryWork: boolean | null | undefined,
): boolean {
  return hasDeliveryWork === false
}

/**
 * DO NOT filter rollups on pod_sub_context. Tried on 2026-09-29, reverted the
 * same hour.
 *
 * The idea was sound — Pod 1 carries a marketing book and a hosting book, and
 * the rollup showed both — but pod_sub_context does not reliably say what a
 * client BUYS. Of Pod 1's 64 accounts tagged 'maintenance', 20 are invoiced
 * for recurring marketing every month: Ravensberg and Filtration Systems at
 * $3,000, Oakes & Fosher at $2,800, Gausnell at $2,600, down to Alan Freed at
 * $400 — $31,955/mo in all. Filtering on the tag hid every one of them from
 * the team's board.
 *
 * Same lesson as the service-name work in Pulse: the label does not say what
 * the work is, and billing is the reliable signal. Central has no billing
 * data, so the fix is either to correct those 20 tags in Pulse or to sync a
 * derived flag — not to key on a field that is wrong a third of the time.
 */

export function isHiddenRollupAccountStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false
  return (HIDDEN_ROLLUP_ACCOUNT_STATUSES as readonly string[]).includes(
    status.trim().toLowerCase(),
  )
}

/**
 * Drop sources whose client is terminated, or has no paid delivery work.
 * Shape-agnostic on purpose.
 */
export function filterActiveRollupSources<
  T extends {
    sourceBoard?: {
      client?: {
        accountStatus?: string | null
        hasDeliveryWork?: boolean | null
      } | null
    } | null
  },
>(sources: T[]): T[] {
  return sources.filter((s) => {
    const client = s.sourceBoard?.client
    if (isHiddenRollupAccountStatus(client?.accountStatus)) return false
    if (isHiddenRollupDeliveryState(client?.hasDeliveryWork)) return false
    return true
  })
}
