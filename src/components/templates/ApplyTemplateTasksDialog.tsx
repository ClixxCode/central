'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { useBoards, useBoard, useApplyTemplateTasksToBoard } from '@/lib/hooks';
import type { TemplateDetail } from '@/lib/actions/templates';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface ApplyTemplateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateDetail;
}

type Step = 'select_board' | 'map_statuses' | 'confirm';

export function ApplyTemplateTasksDialog({
  open,
  onOpenChange,
  template,
}: ApplyTemplateTasksDialogProps) {
  const [step, setStep] = React.useState<Step>('select_board');
  const [boardId, setBoardId] = React.useState('');
  const [statusMapping, setStatusMapping] = React.useState<Record<string, string>>({});
  const [sectionMapping, setSectionMapping] = React.useState<Record<string, string | null>>({});

  const { data: boards = [] } = useBoards();
  const { data: board } = useBoard(boardId);
  const applyTasks = useApplyTemplateTasksToBoard();

  const isBoardTemplate = template.type === 'board_template';
  const taskCount = template.tasks.reduce(
    (acc, t) => acc + 1 + (t.subtasks?.length ?? 0),
    0
  );

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setStep('select_board');
      setBoardId('');
      setStatusMapping({});
      setSectionMapping({});
    }
  }, [open]);

  // Auto-map statuses when board is selected
  React.useEffect(() => {
    if (!board || !isBoardTemplate) return;

    const boardStatuses = (board.statusOptions ?? []) as StatusOption[];
    const templateStatuses = template.statusOptions;

    // Auto-map by case-insensitive label match
    const mapping: Record<string, string> = {};
    for (const ts of templateStatuses) {
      const match = boardStatuses.find(
        (bs) => bs.label.toLowerCase() === ts.label.toLowerCase()
      );
      mapping[ts.id] = match?.id ?? boardStatuses[0]?.id ?? '';
    }
    setStatusMapping(mapping);

    // Auto-map sections
    const boardSections = (board.sectionOptions ?? []) as SectionOption[];
    const templateSections = template.sectionOptions;
    const secMapping: Record<string, string | null> = {};
    for (const ts of templateSections) {
      const match = boardSections.find(
        (bs) => bs.label.toLowerCase() === ts.label.toLowerCase()
      );
      secMapping[ts.id] = match?.id ?? null;
    }
    setSectionMapping(secMapping);
  }, [board, isBoardTemplate, template.statusOptions, template.sectionOptions]);

  // Check if all statuses and sections already match by label — skip mapping if so
  const allMappingsMatch = React.useMemo(() => {
    if (!board || !isBoardTemplate) return true;
    const bs = (board.statusOptions ?? []) as StatusOption[];
    const bsec = (board.sectionOptions ?? []) as SectionOption[];

    const statusesMatch = template.statusOptions.every((ts) =>
      bs.some((s) => s.label.toLowerCase() === ts.label.toLowerCase())
    );
    const sectionsMatch = template.sectionOptions.every((ts) =>
      bsec.some((s) => s.label.toLowerCase() === ts.label.toLowerCase())
    );
    return statusesMatch && sectionsMatch;
  }, [board, isBoardTemplate, template.statusOptions, template.sectionOptions]);

  const needsMapping = isBoardTemplate && template.statusOptions.length > 0 && !allMappingsMatch;

  const handleNext = () => {
    if (step === 'select_board') {
      if (needsMapping) {
        setStep('map_statuses');
      } else {
        setStep('confirm');
      }
    } else if (step === 'map_statuses') {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      if (needsMapping) {
        setStep('map_statuses');
      } else {
        setStep('select_board');
      }
    } else if (step === 'map_statuses') {
      setStep('select_board');
    }
  };

  const handleApply = () => {
    applyTasks.mutate(
      {
        templateId: template.id,
        boardId,
        statusMapping: isBoardTemplate ? statusMapping : undefined,
        sectionMapping: isBoardTemplate ? sectionMapping : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const boardStatuses = (board?.statusOptions ?? []) as StatusOption[];
  const boardSections = (board?.sectionOptions ?? []) as SectionOption[];

  // Filter to standard boards only
  const standardBoards = boards.filter((b) => b.type === 'standard');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Tasks to Board</DialogTitle>
          <DialogDescription>
            {step === 'select_board' && 'Select the board to add tasks to.'}
            {step === 'map_statuses' && 'Map template statuses and sections to the board.'}
            {step === 'confirm' && '\u00A0'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Select board */}
          {step === 'select_board' && (
            <div className="space-y-2">
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a board..." />
                </SelectTrigger>
                <SelectContent>
                  {standardBoards.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.clientName ? `${b.clientName} / ` : ''}{b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 2: Map statuses */}
          {step === 'map_statuses' && (
            <ScrollArea className="max-h-80">
              <div className="space-y-4">
                {/* Status mapping */}
                {template.statusOptions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Status Mapping</h4>
                    {template.statusOptions
                      .sort((a, b) => a.position - b.position)
                      .map((ts) => (
                        <div key={ts.id} className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="border-0 font-medium text-xs shrink-0"
                            style={{ backgroundColor: `${ts.color}20`, color: ts.color }}
                          >
                            <span
                              className="size-2 rounded-full mr-1"
                              style={{ backgroundColor: ts.color }}
                            />
                            {ts.label}
                          </Badge>
                          <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                          <Select
                            value={statusMapping[ts.id] ?? ''}
                            onValueChange={(val) =>
                              setStatusMapping((prev) => ({ ...prev, [ts.id]: val }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {boardStatuses.map((bs) => (
                                <SelectItem key={bs.id} value={bs.id}>
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="size-2 rounded-full"
                                      style={{ backgroundColor: bs.color }}
                                    />
                                    {bs.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                  </div>
                )}

                {/* Section mapping */}
                {template.sectionOptions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Section Mapping</h4>
                    {template.sectionOptions
                      .sort((a, b) => a.position - b.position)
                      .map((ts) => (
                        <div key={ts.id} className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="border-0 font-medium text-xs shrink-0"
                            style={{ backgroundColor: `${ts.color}20`, color: ts.color }}
                          >
                            {ts.label}
                          </Badge>
                          <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                          <Select
                            value={sectionMapping[ts.id] ?? '__none__'}
                            onValueChange={(val) =>
                              setSectionMapping((prev) => ({
                                ...prev,
                                [ts.id]: val === '__none__' ? null : val,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">(No section)</SelectItem>
                              {boardSections.map((bs) => (
                                <SelectItem key={bs.id} value={bs.id}>
                                  {bs.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p>
                <strong>{taskCount}</strong> {taskCount === 1 ? 'task' : 'tasks'} will be added to the board.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step !== 'select_board' && (
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step === 'select_board' && (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step !== 'confirm' ? (
            <Button onClick={handleNext} disabled={!boardId}>
              Next
            </Button>
          ) : (
            <Button onClick={handleApply} disabled={applyTasks.isPending}>
              {applyTasks.isPending ? 'Adding Tasks...' : 'Add Tasks'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
