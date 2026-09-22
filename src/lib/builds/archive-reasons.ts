/**
 * Agentic Website Builds — why a build left the board.
 *
 * A build is never silently removed: taking it off the board requires picking
 * one of these reasons, which is stored on the task alongside `archivedAt`.
 * Archiving is soft — the build's `build_stage_events` rows survive, so a build
 * that spent six weeks in Design System before the client cancelled still
 * counts as measured effort.
 *
 * `excludeFromAnalytics` is the important flag: it separates bookkeeping noise
 * (a duplicate card, a mis-click) from real abandoned effort. Pulse's pricing
 * engine should read Central's stage timings with the noise reasons filtered
 * out and the genuine ones kept — an abandoned build is signal about how long
 * work takes, a duplicate card is not.
 *
 * This is the single source of truth for the reason list; edit it here rather
 * than in the components. Ids are persisted, so rename labels freely but never
 * an id (add a new one instead).
 */
export interface BuildArchiveReason {
  id: string;
  /** Option label in the archive dialog. */
  label: string;
  /** One line of guidance under the label. */
  description: string;
  /** True = bookkeeping noise; its stage timings should not feed pricing. */
  excludeFromAnalytics: boolean;
}

export const BUILD_ARCHIVE_REASONS: BuildArchiveReason[] = [
  {
    id: 'client_cancelled',
    label: 'Client cancelled',
    description: 'Client pulled the project. Work done so far still counts.',
    excludeFromAnalytics: false,
  },
  {
    id: 'account_churned',
    label: 'Account churned',
    description: 'The account left Clix before the build finished.',
    excludeFromAnalytics: false,
  },
  {
    id: 'descoped',
    label: 'Descoped / absorbed',
    description: 'Folded into another project or dropped from the SOW.',
    excludeFromAnalytics: false,
  },
  {
    id: 'superseded',
    label: 'Superseded',
    description: 'Replaced by a different build card for the same site.',
    excludeFromAnalytics: false,
  },
  {
    id: 'on_hold',
    label: 'On hold indefinitely',
    description: 'Paused with no restart date. Restore it when work resumes.',
    excludeFromAnalytics: false,
  },
  {
    id: 'duplicate',
    label: 'Duplicate card',
    description: 'The same build already exists on the board.',
    excludeFromAnalytics: true,
  },
  {
    id: 'created_in_error',
    label: 'Created in error',
    description: 'Never a real build — wrong client, test card, mis-click.',
    excludeFromAnalytics: true,
  },
];

const BY_ID = new Map(BUILD_ARCHIVE_REASONS.map((r) => [r.id, r]));

export function getBuildArchiveReason(id: string | null | undefined): BuildArchiveReason | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function isValidBuildArchiveReason(id: string | null | undefined): id is string {
  return !!id && BY_ID.has(id);
}

/** Reason ids whose builds should be kept out of duration analytics. */
export const NOISE_ARCHIVE_REASON_IDS = BUILD_ARCHIVE_REASONS.filter(
  (r) => r.excludeFromAnalytics,
).map((r) => r.id);
