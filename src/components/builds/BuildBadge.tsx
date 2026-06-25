import { Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBuildStage, BUILD_ACCENT_COLOR } from '@/lib/builds/stages';

/**
 * Distinguishes an agentic website build card on any board (client board,
 * rollup, My Work). Shows a hammer + the pipeline stage, tinted with the build
 * accent color. Render only when task.isAgenticBuild is true.
 */
export function BuildBadge({ buildStage, className }: { buildStage?: string | null; className?: string }) {
  const stage = getBuildStage(buildStage);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none',
        className
      )}
      style={{ backgroundColor: `${BUILD_ACCENT_COLOR}1A`, color: BUILD_ACCENT_COLOR }}
      title={stage ? `Agentic build — ${stage.label}` : 'Agentic build'}
    >
      <Hammer className="size-3" />
      {stage ? stage.label : 'Build'}
    </span>
  );
}
