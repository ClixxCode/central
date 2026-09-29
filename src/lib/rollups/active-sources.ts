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
 * Pod sub-contexts whose clients buy no marketing, so they have no delivery
 * work to roll up.
 *
 * A pod answers WHO OWNS the account; pod_sub_context answers WHAT WE DO for
 * it. Pod 1 carries both — 16 nurture clients with live campaigns and 25 on
 * hosting/maintenance only — and the rollup keyed on the pod alone, so a $500
 * hosting client sat on the delivery board beside the marketing book.
 *
 * Filtered here rather than by moving those accounts off Pod 1 in Pulse: they
 * still have an account manager who owns them, and stripping the pod to fix a
 * board would throw that ownership away. Shared Resource already means
 * "contractor pool"; loading it with hosting clients would make it mean two
 * unrelated things.
 *
 * Both values are already synced — ops.account_snapshot ships
 * 'pod': {id, name, sub_context} and clients.pod_sub_context is populated.
 * Nothing needed building; the rollup simply never read the column next to the
 * one it was keying on.
 *
 * DENY-list for the same reason as the statuses above: a null sub-context must
 * keep showing. Two live Pod 1 accounts carry one, and one of them (Lutheran
 * Living Communities) is an onboarding client with a running website build —
 * exactly the delivery work a rollup exists to show.
 */
export const HIDDEN_ROLLUP_POD_SUB_CONTEXTS = [
  "maintenance",
  "hosting-only",
] as const

export function isHiddenRollupPodSubContext(
  subContext: string | null | undefined,
): boolean {
  if (!subContext) return false
  return (HIDDEN_ROLLUP_POD_SUB_CONTEXTS as readonly string[]).includes(
    subContext.trim().toLowerCase(),
  )
}

export function isHiddenRollupAccountStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false
  return (HIDDEN_ROLLUP_ACCOUNT_STATUSES as readonly string[]).includes(
    status.trim().toLowerCase(),
  )
}

/**
 * Drop sources whose client is terminated, or buys no marketing.
 * Shape-agnostic on purpose.
 */
export function filterActiveRollupSources<
  T extends {
    sourceBoard?: {
      client?: {
        accountStatus?: string | null
        podSubContext?: string | null
      } | null
    } | null
  },
>(sources: T[]): T[] {
  return sources.filter((s) => {
    const client = s.sourceBoard?.client
    if (isHiddenRollupAccountStatus(client?.accountStatus)) return false
    if (isHiddenRollupPodSubContext(client?.podSubContext)) return false
    return true
  })
}
