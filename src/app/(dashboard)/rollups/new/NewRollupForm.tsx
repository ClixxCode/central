'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateRollupBoard, useRollupRuleOptions } from '@/lib/hooks/useRollupBoards';
import type { RollupRuleInput } from '@/lib/validations/rollup';

type RuleType = 'pod' | 'assignment' | 'lifecycle';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function NewRollupForm() {
  const router = useRouter();
  const createRollup = useCreateRollupBoard();
  const { data: options, isLoading: isLoadingOptions } = useRollupRuleOptions();

  const [name, setName] = React.useState('');
  const [ruleType, setRuleType] = React.useState<RuleType>('pod');
  const [podName, setPodName] = React.useState('');
  const [staffId, setStaffId] = React.useState('');
  const [role, setRole] = React.useState<'any' | 'management' | 'delivery'>('any');
  const [statuses, setStatuses] = React.useState<string[]>(['offboarding', 'terminated']);
  const [error, setError] = React.useState<string | null>(null);

  function buildRule(): RollupRuleInput | null {
    if (ruleType === 'pod') {
      return podName ? { type: 'pod', pod_name: podName } : null;
    }
    if (ruleType === 'assignment') {
      return staffId
        ? { type: 'assignment', staff_id: staffId, role: role === 'any' ? null : role }
        : null;
    }
    return statuses.length > 0 ? { type: 'lifecycle', statuses } : null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    const rule = buildRule();
    if (!rule) return setError('Complete the rule (pick a pod, person, or status)');
    setError(null);
    createRollup.mutate(
      { name: name.trim(), rule },
      { onSuccess: (data) => router.push(`/rollups/${data.id}`) },
    );
  };

  const toggleStatus = (s: string) =>
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Rollup Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Pod 1, Lauren's Clients, Offboarding"
              disabled={createRollup.isPending}
            />
          </div>

          {/* Rule */}
          <div className="space-y-2">
            <Label>Membership rule</Label>
            <p className="text-sm text-muted-foreground">
              Members are derived automatically from Pulse — no manual board picking. Pod and
              assignment changes in Pulse keep this rollup in sync.
            </p>
            <select
              className={SELECT_CLASS}
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              disabled={createRollup.isPending}
            >
              <option value="pod">By pod</option>
              <option value="assignment">By assignment (person)</option>
              <option value="lifecycle">By lifecycle status</option>
            </select>
          </div>

          {isLoadingOptions ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading options…
            </div>
          ) : (
            <div className="space-y-2">
              {ruleType === 'pod' && (
                <select
                  className={SELECT_CLASS}
                  value={podName}
                  onChange={(e) => setPodName(e.target.value)}
                  disabled={createRollup.isPending}
                >
                  <option value="">Select a pod…</option>
                  {(options?.pods ?? []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}

              {ruleType === 'assignment' && (
                <div className="space-y-2">
                  <select
                    className={SELECT_CLASS}
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    disabled={createRollup.isPending}
                  >
                    <option value="">Select a person…</option>
                    {(options?.people ?? []).map((p) => (
                      <option key={p.staffId} value={p.staffId}>
                        {p.name || p.staffId}
                      </option>
                    ))}
                  </select>
                  <select
                    className={SELECT_CLASS}
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'any' | 'management' | 'delivery')}
                    disabled={createRollup.isPending}
                  >
                    <option value="any">Any role on the account</option>
                    <option value="management">Management (AM / BD)</option>
                    <option value="delivery">Delivery (strategists)</option>
                  </select>
                </div>
              )}

              {ruleType === 'lifecycle' && (
                <div className="flex flex-wrap gap-3">
                  {(options?.statuses ?? []).map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm capitalize">
                      <input
                        type="checkbox"
                        checked={statuses.includes(s)}
                        onChange={() => toggleStatus(s)}
                        disabled={createRollup.isPending}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createRollup.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createRollup.isPending}>
            {createRollup.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Rollup
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
