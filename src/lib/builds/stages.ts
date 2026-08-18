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
export interface BuildStage {
  id: string;
  label: string;
  color: string;
  position: number;
  /** Optional umbrella band a stage belongs to (adjacent same-group stages
   *  render under one caption on the board — e.g. "In Progress" over
   *  Design System + Development). */
  group?: string;
}

export const BUILD_STAGES: BuildStage[] = [
  { id: 'planned', label: 'Planned', color: '#A855F7', position: 0 },
  { id: 'next_up', label: 'Next Up', color: '#06B6D4', position: 1 },
  { id: 'onboarding', label: 'Onboarding', color: '#14B8A6', position: 2, group: 'In Progress' },
  { id: 'design_system', label: 'Design System', color: '#6366F1', position: 3, group: 'In Progress' },
  { id: 'development', label: 'Development', color: '#3B82F6', position: 4, group: 'In Progress' },
  { id: 'qa', label: 'QA', color: '#F59E0B', position: 5 },
  { id: 'complete', label: 'Complete', color: '#10B981', position: 6 },
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
