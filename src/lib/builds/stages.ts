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
}

export const BUILD_STAGES: BuildStage[] = [
  { id: 'on_the_bench', label: 'On the Bench', color: '#6B7280', position: 0 },
  { id: 'planned', label: 'Planned', color: '#A855F7', position: 1 },
  { id: 'next_up', label: 'Next Up', color: '#06B6D4', position: 2 },
  { id: 'in_progress', label: 'In Progress', color: '#3B82F6', position: 3 },
  { id: 'qa', label: 'QA', color: '#F59E0B', position: 4 },
  { id: 'complete', label: 'Complete', color: '#10B981', position: 5 },
];

/** Accent color used to visually distinguish build cards on any board. */
export const BUILD_ACCENT_COLOR = '#7C3AED';

export const DEFAULT_BUILD_STAGE = 'on_the_bench';

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
