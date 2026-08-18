'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateBuild, useUpdateBuild } from '@/lib/hooks';
import { BUILD_STAGES } from '@/lib/builds/stages';
import { BUILD_TYPES, buildTypeIsFee, formatDuration } from '@/lib/builds/format';
import type { AgenticBuild, BuildType, BuildableClient } from '@/lib/actions/builds';

type Props =
  | {
      mode: 'add';
      open: boolean;
      onOpenChange: (o: boolean) => void;
      clients: BuildableClient[];
      build?: undefined;
    }
  | {
      mode: 'edit';
      open: boolean;
      onOpenChange: (o: boolean) => void;
      build: AgenticBuild;
      clients?: undefined;
    };

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

export function BuildDialog(props: Props) {
  const { mode, open, onOpenChange } = props;
  const createBuild = useCreateBuild();
  const updateBuild = useUpdateBuild();

  const [clientId, setClientId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [buildStage, setBuildStage] = React.useState<string>(BUILD_STAGES[0].id);
  const [buildType, setBuildType] = React.useState<BuildType | ''>('');
  const [projectValue, setProjectValue] = React.useState('');
  const [commencementDate, setCommencementDate] = React.useState('');

  // Seed the form each time it opens.
  React.useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      const b = props.build;
      setTitle(b.title);
      setBuildStage(b.buildStage);
      setBuildType((b.buildType as BuildType | null) ?? '');
      setProjectValue(b.projectValue != null ? String(b.projectValue) : '');
      setCommencementDate(b.commencementDate ?? '');
    } else {
      setClientId('');
      setTitle('');
      setBuildStage(BUILD_STAGES[0].id);
      setBuildType('');
      setProjectValue('');
      setCommencementDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const feeRequired = buildTypeIsFee(buildType || null);
  const busy = createBuild.isPending || updateBuild.isPending;
  const valueNum = projectValue ? Number(projectValue) : null;
  const canSubmit =
    !busy &&
    title.trim() &&
    (mode === 'edit' || clientId) &&
    (!feeRequired || (valueNum != null && valueNum > 0));

  function handleSubmit() {
    if (!canSubmit) return;
    const type = (buildType || null) as BuildType | null;
    if (mode === 'add') {
      const client = props.clients.find((c) => c.id === clientId);
      if (!client) return;
      createBuild.mutate(
        {
          boardId: client.boardId,
          title: title.trim(),
          buildStage,
          buildType: type,
          projectValue: feeRequired ? valueNum : null,
          commencementDate: feeRequired && commencementDate ? commencementDate : null,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      updateBuild.mutate(
        {
          taskId: props.build.id,
          input: {
            title: title.trim(),
            buildStage,
            buildType: type,
            projectValue: feeRequired ? valueNum : null,
            commencementDate: feeRequired && commencementDate ? commencementDate : null,
          },
        },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add a website build' : 'Edit build'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {mode === 'add' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Client</label>
              <select className={selectCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select a client…</option>
                {props.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Build name</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Riley Hays — main site" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <select className={selectCls} value={buildStage} onChange={(e) => setBuildStage(e.target.value)}>
                {BUILD_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                className={selectCls}
                value={buildType}
                onChange={(e) => setBuildType(e.target.value as BuildType | '')}
              >
                <option value="">Select type…</option>
                {BUILD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feeRequired && (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Total project value <span className="text-rose-600">*</span>
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={projectValue}
                  onChange={(e) => setProjectValue(e.target.value)}
                  placeholder="e.g. 8400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Commencement</label>
                <Input
                  type="date"
                  value={commencementDate}
                  onChange={(e) => setCommencementDate(e.target.value)}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">When work officially started (starts the timer).</p>
              </div>
            </div>
          )}

          {mode === 'edit' && <TimingBreakdown build={props.build} />}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mode === 'add' ? 'Add build' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only time-in-stage + total, shown in the edit dialog. */
function TimingBreakdown({ build }: { build: AgenticBuild }) {
  const WORK_STAGES = ['onboarding', 'design_system', 'development', 'qa'];
  const per = build.timing.perStageMs;
  const anyTiming = build.timing.totalMs != null || WORK_STAGES.some((s) => (per[s] ?? 0) > 0);
  if (!anyTiming) {
    return (
      <p className="text-xs text-muted-foreground">
        Timing starts once a commencement date is set and the build moves through stages.
      </p>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time in stage</span>
        {build.timing.totalMs != null && (
          <span className="text-xs text-muted-foreground">
            Total {formatDuration(build.timing.totalMs)}
            {build.completedAt ? ' · completed' : ' · running'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {WORK_STAGES.map((s) => {
          const label = BUILD_STAGES.find((x) => x.id === s)?.label ?? s;
          return (
            <div key={s} className="text-center">
              <div className="text-sm font-semibold">{formatDuration(per[s] ?? 0)}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
