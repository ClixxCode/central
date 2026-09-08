/**
 * Agentic Website Builds — pipeline stages.
 *
 * A build is a normal Central task flagged `isAgenticBuild` that carries a
 * `buildStage` (one of the ids below) independent of its board status. The
 * standalone Agentic Website Builds board groups build cards into these stage
 * columns, left → right. Stages are an app-level constant (not per-board, not
 * editable in the status editor) so the pipeline is uniform org-wide.
 *
 * Mirrors the StatusOption shape ({ id, label, color, position }) so the build
 * board can render columns with the same primitives as a normal kanban board.
 */
/** A build-type-specific launch path shown in the Complete stage's info card.
 *  The board's info popover is column-level (not per-card), so Complete lists
 *  every launch path rather than picking one — the builder follows the row that
 *  matches the card's project type. */
export interface StageLaunchPath {
  /** Human label for the project type (e.g. "WordPress → Astro migration"). */
  type: string;
  /** The production launch step for that type. */
  step: string;
}

/** Editable "what this stage means" content surfaced via the ℹ️ popover on each
 *  column header. Kept here (single source of truth) so definitions can evolve
 *  without touching the board component. */
export interface StageInfo {
  /** One-line definition of the stage. */
  definition: string;
  /** "Includes" — the concrete components/activities of the stage. */
  components: string[];
  /** Exit criteria — what must be true to move to the next stage. */
  doneWhen: string;
  /** Complete only: production launch forks by project type. */
  launchPaths?: StageLaunchPath[];
}

export interface BuildStage {
  id: string;
  label: string;
  color: string;
  position: number;
  /** Optional umbrella band a stage belongs to (adjacent same-group stages
   *  render under one caption on the board — e.g. "In Progress" over
   *  Design System + Development). */
  group?: string;
  /** Definition + component checklist shown in the column-header info popover. */
  info?: StageInfo;
}

export const BUILD_STAGES: BuildStage[] = [
  {
    id: 'planned',
    label: 'Planned',
    color: '#A855F7',
    position: 0,
    info: {
      definition: 'Build is scoped and approved but not yet scheduled to start.',
      components: [
        'SOW / scope confirmed',
        'Project type set (WordPress creative build · WordPress → Astro migration · WordPress → WordPress migration)',
        'Economics tagged (proactive / budgeted) + project value if fee-based',
        'Commencement + target-end dates set',
      ],
      doneWhen: 'Ready to slot into the team’s queue.',
    },
  },
  {
    id: 'next_up',
    label: 'Next Up',
    color: '#06B6D4',
    position: 1,
    info: {
      definition: 'Queued to start next — kickoff imminent, nothing built yet.',
      components: [
        'Assigned to a builder / pod',
        'Kickoff scheduled with the client',
        'Access + credential requests initiated',
      ],
      doneWhen: 'Kickoff happens and onboarding begins.',
    },
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    color: '#14B8A6',
    position: 2,
    group: 'In Progress',
    info: {
      definition: 'Gathering everything needed to build.',
      components: [
        'Client kickoff',
        'Access + credentials collected (WP Engine, DNS, hosting, GBP, analytics)',
        'Brand assets + logo + content brief',
        'Page inventory / sitemap confirmed',
        'Source site captured (existing content + media)',
        'Scope + goals confirmed against the SOW',
      ],
      doneWhen: 'All inputs in hand and source content captured — nothing blocked on the client.',
    },
  },
  {
    id: 'design_system',
    label: 'Design System',
    color: '#6366F1',
    position: 3,
    group: 'In Progress',
    info: {
      definition: 'Establishing the visual + structural foundation before mass page building.',
      components: [
        'Brand tokens (color / type)',
        'Reusable section / component library',
        'Page templates (home + key layouts)',
        'Design direction drafted in Claude Design',
        'Client design approval on look & feel',
      ],
      doneWhen: 'Templates + component library approved — pages can be produced without re-deciding design.',
    },
  },
  {
    id: 'development',
    label: 'Development',
    color: '#3B82F6',
    position: 4,
    group: 'In Progress',
    info: {
      definition: 'Building all pages on the platform against the approved system.',
      components: [
        'Full page build-out (Astro)',
        'Design system applied site-wide',
        'Content ported / migrated',
        'Responsive / mobile',
        'Internal linking',
        'SEO metadata + schema',
        'Redirect mapping from old URLs',
      ],
      doneWhen: 'Every scoped page is built on staging and self-consistent — ready to show the client.',
    },
  },
  {
    id: 'qa',
    label: 'QA',
    color: '#F59E0B',
    position: 5,
    info: {
      definition: 'Client review on staging for initial feedback — site not necessarily complete.',
      components: [
        'Client review round + feedback captured',
        'Form + Supabase / CRM wiring created or confirmed and tested',
        'Conversion + call tracking verified',
        'Cross-browser / mobile pass',
        'Links, schema, redirects validated',
        'Performance check',
      ],
      doneWhen: 'Client feedback incorporated, wiring verified end-to-end, launch checklist passed.',
    },
  },
  {
    id: 'complete',
    label: 'Complete',
    color: '#10B981',
    position: 6,
    info: {
      definition: 'Launched to production and handed off.',
      launchPaths: [
        { type: 'WordPress → Astro migration', step: 'DNS cutover WP Engine → Vercel' },
        { type: 'WordPress creative build', step: 'Publish live on WP Engine (DNS pointed; no Vercel)' },
        { type: 'WordPress → WordPress migration', step: 'Cutover to the new install / host' },
      ],
      components: [
        'SSL verified in production',
        'Redirects confirmed (migrations / rebuilds — old URLs → new)',
        'Post-launch smoke test',
        'Forms + conversion / call tracking firing in production',
        'Analytics / GSC verified live',
        'Handoff to AM / maintenance',
        'SOW deliverable closed',
      ],
      doneWhen: 'Site is live on the correct production platform, verified, and the account is transitioned to its ongoing tier / pod.',
    },
  },
];

/** Accent color used to visually distinguish build cards on any board. */
export const BUILD_ACCENT_COLOR = '#7C3AED';

export const DEFAULT_BUILD_STAGE = 'planned';

/**
 * The "beta gate": a build crossing from Development into this stage (QA) is far
 * enough along to put in front of the client for beta review — incomplete, but
 * ready for feedback. The board draws a dashed divider immediately before this
 * stage's column to mark the line.
 */
export const BETA_GATE_BEFORE_STAGE_ID = 'qa';
export const BETA_GATE_LABEL = 'Client beta review';

const BUILD_STAGE_BY_ID = new Map(BUILD_STAGES.map((s) => [s.id, s]));

export function getBuildStage(id: string | null | undefined): BuildStage | undefined {
  return id ? BUILD_STAGE_BY_ID.get(id) : undefined;
}

export function isValidBuildStage(id: string | null | undefined): id is string {
  return !!id && BUILD_STAGE_BY_ID.has(id);
}

/** Resolve a free-text stage label (e.g. from a spreadsheet) to a stage id. */
export function resolveBuildStageId(input: string): string | undefined {
  const norm = input.trim().toLowerCase().replace(/[^a-z]/g, '');
  for (const s of BUILD_STAGES) {
    if (s.label.toLowerCase().replace(/[^a-z]/g, '') === norm || s.id.replace(/[^a-z]/g, '') === norm) {
      return s.id;
    }
  }
  return undefined;
}
