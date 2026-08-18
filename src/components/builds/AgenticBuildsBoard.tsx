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
import { Plus, Calendar, ExternalLink, Hammer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AssigneeAvatars } from '@/components/tasks/AssigneePicker';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useAgenticBuilds, useBuildableClients, useCreateBuild, useSetBuildStage } from '@/lib/hooks';
import { useDragToScroll } from '@/lib/hooks/useDragToScroll';
import {
  BUILD_STAGES,
  DEFAULT_BUILD_STAGE,
  BUILD_ACCENT_COLOR,
  BETA_GATE_BEFORE_STAGE_ID,
  BETA_GATE_LABEL,
  type BuildStage,
} from '@/lib/builds/stages';
import type { AgenticBuild } from '@/lib/actions/builds';

/** Presentational card (drag wiring lives on the wrapper in DraggableBuildCard). */
function BuildCard({ build, overlay }: { build: AgenticBuild; overlay?: boolean }) {
  const href =
    build.clientSlug && build.boardId
      ? `/clients/${build.clientSlug}/boards/${build.boardId}`
      : undefined;

  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-3 shadow-sm transition-all',
        'border-l-[3px]',
        overlay && 'shadow-lg rotate-2 cursor-grabbing'
      )}
      style={{ borderLeftColor: BUILD_ACCENT_COLOR }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground/60">
          <Hammer className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          {build.clientName && (
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClientIcon icon={build.clientIcon} color={build.clientColor ?? '#6B7280'} name={build.clientName} size="sm" />
              <span className="truncate">{build.clientName}</span>
            </div>
          )}
          <p className="text-sm font-medium leading-snug">{build.title}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {build.dueDate && (
                <span className="inline-flex items-center gap-1">
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
function DraggableBuildCard({ build }: { build: AgenticBuild }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: build.id });
  return (
    <div
      ref={setNodeRef}
      className={cn('cursor-grab touch-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <BuildCard build={build} />
    </div>
  );
}

function StageColumn({
  stage,
  builds,
}: {
  stage: (typeof BUILD_STAGES)[number];
  builds: AgenticBuild[];
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
          <DraggableBuildCard key={b.id} build={b} />
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
    <div className="relative flex flex-1 items-stretch justify-center px-1" aria-hidden>
      <div className="my-1 border-l-2 border-dashed border-muted-foreground/40" />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70"
        style={{ writingMode: 'vertical-rl', transform: 'translate(-50%, -50%) rotate(180deg)' }}
      >
        {BETA_GATE_LABEL} →
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
  const createBuild = useCreateBuild();
  const setStage = useSetBuildStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useDragToScroll();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState({ clientId: '', title: '', buildStage: DEFAULT_BUILD_STAGE });

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

  function handleCreate() {
    const client = clients.find((c) => c.id === form.clientId);
    if (!client || !form.title.trim()) return;
    createBuild.mutate(
      { boardId: client.boardId, title: form.title.trim(), buildStage: form.buildStage },
      {
        onSuccess: () => {
          setAddOpen(false);
          setForm({ clientId: '', title: '', buildStage: DEFAULT_BUILD_STAGE });
        },
      }
    );
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
                  <div key={`gate-${i}`} className="flex w-8 shrink-0 flex-col">
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
                        <StageColumn key={stage.id} stage={stage} builds={byStage.get(stage.id) ?? []} />
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={seg.stage.id} className="flex flex-col">
                  <div className="mb-2 h-5" />
                  <StageColumn stage={seg.stage} builds={byStage.get(seg.stage.id) ?? []} />
                </div>
              );
            })}
          </div>
          <DragOverlay>{activeBuild ? <BuildCard build={activeBuild} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a website build</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Client</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Build name</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Riley Hays — main site"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.buildStage}
                onChange={(e) => setForm((f) => ({ ...f, buildStage: e.target.value }))}
              >
                {BUILD_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!form.clientId || !form.title.trim() || createBuild.isPending}>
              Add Build
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
