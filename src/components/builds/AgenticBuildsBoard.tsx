'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Calendar, ExternalLink, Hammer, Pencil, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AssigneeAvatars } from '@/components/tasks/AssigneePicker';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useAgenticBuilds, useBuildableClients, useSetBuildStage } from '@/lib/hooks';
import { useDragToScroll } from '@/lib/hooks/useDragToScroll';
import { BuildDialog } from './BuildDialog';
import { buildTypeMeta, buildAccentColor, formatMoney, formatDuration } from '@/lib/builds/format';
import {
  BUILD_STAGES,
  DEFAULT_BUILD_STAGE,
  BUILD_ACCENT_COLOR,
  BETA_GATE_BEFORE_STAGE_ID,
  BETA_GATE_LABEL,
  type BuildStage,
} from '@/lib/builds/stages';
import type { AgenticBuild } from '@/lib/actions/builds';

/** Small pod tag on a build card, reflecting the account's Pulse-synced pod. */
function PodChip({ pod }: { pod: string }) {
  const key = pod.toLowerCase();
  const cls = key.includes('1')
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
    : key.includes('2')
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none', cls)}
      title={`Account pod: ${pod}`}
    >
      {pod}
    </span>
  );
}

/** Type badge on a build card — colour tracks type by salience. */
function TypeBadge({ build }: { build: AgenticBuild }) {
  const meta = buildTypeMeta(build.buildType);
  if (!meta) return null;
  return (
    <span
      className={cn(
        'rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none',
        meta.badgeClass,
      )}
    >
      {meta.short}
      {meta.fee && build.projectValue != null ? ` · ${formatMoney(build.projectValue)}` : ''}
    </span>
  );
}

/** Colour the target end date so a slipping build can't hide: red once past
 *  target, amber within ~2 weeks, muted otherwise. Completed builds stay muted. */
function dueTone(build: AgenticBuild): string {
  if (!build.dueDate || build.buildStage === 'complete') return 'text-muted-foreground';
  const today = new Date().toISOString().slice(0, 10);
  if (build.dueDate < today) return 'font-medium text-red-600 dark:text-red-400';
  const days =
    (new Date(`${build.dueDate}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
    86_400_000;
  if (days <= 14) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

/** Presentational card (drag wiring lives on the wrapper in DraggableBuildCard). */
function BuildCard({
  build,
  overlay,
  onEdit,
}: {
  build: AgenticBuild;
  overlay?: boolean;
  onEdit?: (b: AgenticBuild) => void;
}) {
  const href =
    build.clientSlug && build.boardId
      ? `/clients/${build.clientSlug}/boards/${build.boardId}`
      : undefined;
  const stageLabel = BUILD_STAGES.find((s) => s.id === build.buildStage)?.label ?? '';
  const showTimer = build.buildStage !== 'complete' && build.timing.currentStageMs > 3_600_000;

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-background p-3 shadow-sm transition-all',
        'border-l-[3px]',
        overlay && 'shadow-lg rotate-2 cursor-grabbing'
      )}
      style={{ borderLeftColor: buildAccentColor(build.buildType) }}
    >
      {/* Upper-right: pod tag (always). */}
      {build.podName && (
        <div className="absolute right-1.5 top-1.5">
          <PodChip pod={build.podName} />
        </div>
      )}
      {/* Bottom-right: edit pencil (on hover). Solid bg so it reads over avatars. */}
      {onEdit && !overlay && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(build);
          }}
          className="absolute bottom-1.5 right-1.5 rounded border bg-background p-1 text-muted-foreground/60 opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          title="Edit build"
          aria-label="Edit build"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground/60">
          <Hammer className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 pr-12">
          {build.clientName && (
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClientIcon icon={build.clientIcon} color={build.clientColor ?? '#6B7280'} name={build.clientName} size="sm" />
              <span className="truncate">{build.clientName}</span>
            </div>
          )}
          <p className="text-sm font-medium leading-snug">{build.title}</p>
          {(build.buildType || showTimer) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <TypeBadge build={build} />
              {showTimer && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={`In ${stageLabel} for ${formatDuration(build.timing.currentStageMs)}`}
                >
                  <Timer className="size-3" />
                  {formatDuration(build.timing.currentStageMs)}
                </span>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {build.dueDate && (
                <span
                  className={cn('inline-flex items-center gap-1', dueTone(build))}
                  title={`Target end date: ${build.dueDate}`}
                >
                  <Calendar className="size-3" />
                  {build.dueDate}
                </span>
              )}
              {href && (
                <Link
                  href={href}
                  className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Board <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
            <AssigneeAvatars assignees={build.assignees} maxDisplay={3} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Draggable wrapper used inside columns (the overlay renders BuildCard directly). */
function DraggableBuildCard({ build, onEdit }: { build: AgenticBuild; onEdit?: (b: AgenticBuild) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: build.id });
  return (
    <div
      ref={setNodeRef}
      className={cn('cursor-grab touch-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <BuildCard build={build} onEdit={onEdit} />
    </div>
  );
}

function StageColumn({
  stage,
  builds,
  onEdit,
}: {
  stage: (typeof BUILD_STAGES)[number];
  builds: AgenticBuild[];
  onEdit?: (b: AgenticBuild) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <h3 className="text-sm font-semibold">{stage.label}</h3>
        <span className="text-xs text-muted-foreground">{builds.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/30'
        )}
      >
        {builds.map((b) => (
          <DraggableBuildCard key={b.id} build={b} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

/** The dashed "beta gate" drawn between Development and QA. Crossing it (a build
 *  entering QA) means the build is ready to put in front of the client for beta
 *  review — incomplete, but far enough for feedback. */
function BetaGate() {
  return (
    <div className="relative flex flex-1 items-center justify-center" aria-hidden>
      {/* dashed line spans the full height, behind the label pill */}
      <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-muted-foreground/40" />
      {/* readable pill (bg breaks the line); vertical text reads top→bottom */}
      <span
        className="relative whitespace-nowrap rounded-full border border-muted-foreground/25 bg-background px-1.5 py-2 text-[11px] font-medium tracking-wide text-muted-foreground"
        style={{ writingMode: 'vertical-rl' }}
      >
        {BETA_GATE_LABEL}
      </span>
    </div>
  );
}

type BoardSegment =
  | { kind: 'stage'; stage: BuildStage }
  | { kind: 'group'; label: string; stages: BuildStage[] }
  | { kind: 'gate' };

/** Turn the flat stage list into render segments: adjacent same-group stages
 *  collapse under one caption, and a beta gate is inserted before its stage. */
function buildSegments(stages: BuildStage[]): BoardSegment[] {
  const segments: BoardSegment[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage.id === BETA_GATE_BEFORE_STAGE_ID) segments.push({ kind: 'gate' });
    if (stage.group) {
      const last = segments[segments.length - 1];
      if (last && last.kind === 'group' && last.label === stage.group) {
        last.stages.push(stage);
        continue;
      }
      segments.push({ kind: 'group', label: stage.group, stages: [stage] });
      continue;
    }
    segments.push({ kind: 'stage', stage });
  }
  return segments;
}

export function AgenticBuildsBoard() {
  const { data: builds = [], isLoading } = useAgenticBuilds();
  const { data: clients = [] } = useBuildableClients();
  const setStage = useSetBuildStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useDragToScroll();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editBuild, setEditBuild] = React.useState<AgenticBuild | null>(null);

  const byStage = React.useMemo(() => {
    const map = new Map<string, AgenticBuild[]>();
    for (const s of BUILD_STAGES) map.set(s.id, []);
    for (const b of builds) (map.get(b.buildStage) ?? map.get(DEFAULT_BUILD_STAGE)!).push(b);
    for (const list of map.values()) list.sort((a, b) => (a.clientName ?? '').localeCompare(b.clientName ?? ''));
    return map;
  }, [builds]);

  const activeBuild = activeId ? builds.find((b) => b.id === activeId) ?? null : null;
  const segments = React.useMemo(() => buildSegments(BUILD_STAGES), []);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overStage = e.over ? String(e.over.id) : null;
    if (!overStage) return;
    const build = builds.find((b) => b.id === taskId);
    if (!build || build.buildStage === overStage) return;
    setStage.mutate({ taskId, buildStage: overStage });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Hammer className="size-6" style={{ color: BUILD_ACCENT_COLOR }} />
            Agentic Website Builds
          </h1>
          <p className="text-sm text-muted-foreground">
            Every AI website build across the team, by stage. {builds.length} total.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add Build
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading builds…</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div ref={scrollRef} className="flex items-stretch gap-4 overflow-x-auto pb-4">
            {segments.map((seg, i) => {
              if (seg.kind === 'gate') {
                return (
                  <div key={`gate-${i}`} className="flex w-12 shrink-0 flex-col">
                    <div className="mb-2 h-5" />
                    <BetaGate />
                  </div>
                );
              }
              if (seg.kind === 'group') {
                return (
                  <div key={`group-${seg.label}`} className="flex flex-col">
                    <div className="mb-2 flex h-5 items-center border-b border-muted-foreground/25 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      {seg.stages.map((stage) => (
                        <StageColumn key={stage.id} stage={stage} builds={byStage.get(stage.id) ?? []} onEdit={setEditBuild} />
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={seg.stage.id} className="flex flex-col">
                  <div className="mb-2 h-5" />
                  <StageColumn stage={seg.stage} builds={byStage.get(seg.stage.id) ?? []} onEdit={setEditBuild} />
                </div>
              );
            })}
          </div>
          <DragOverlay>{activeBuild ? <BuildCard build={activeBuild} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <BuildDialog mode="add" open={addOpen} onOpenChange={setAddOpen} clients={clients} />
      {editBuild && (
        <BuildDialog
          mode="edit"
          open={!!editBuild}
          onOpenChange={(o) => !o && setEditBuild(null)}
          build={editBuild}
        />
      )}
    </div>
  );
}
