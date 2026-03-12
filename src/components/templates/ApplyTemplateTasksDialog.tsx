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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ArrowRight, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoards, useBoard, useApplyTemplateTasksToBoard } from '@/lib/hooks';
import type { TemplateDetail } from '@/lib/actions/templates';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface ApplyTemplateTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateDetail;
}

type Step = 'select_board' | 'map_statuses' | 'map_sections' | 'confirm';

export function ApplyTemplateTasksDialog({
  open,
  onOpenChange,
  template,
}: ApplyTemplateTasksDialogProps) {
  const [step, setStep] = React.useState<Step>('select_board');
  const [boardId, setBoardId] = React.useState('');
  const [boardPickerOpen, setBoardPickerOpen] = React.useState(false);
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

  // Check if statuses/sections already match by label — skip their mapping steps if so
  const { needsStatusMapping, needsSectionMapping } = React.useMemo(() => {
    if (!board || !isBoardTemplate) return { needsStatusMapping: false, needsSectionMapping: false };
    const bs = (board.statusOptions ?? []) as StatusOption[];
    const bsec = (board.sectionOptions ?? []) as SectionOption[];

    const statusesMatch = template.statusOptions.length === 0 || template.statusOptions.every((ts) =>
      bs.some((s) => s.label.toLowerCase() === ts.label.toLowerCase())
    );
    const sectionsMatch = template.sectionOptions.length === 0 || template.sectionOptions.every((ts) =>
      bsec.some((s) => s.label.toLowerCase() === ts.label.toLowerCase())
    );
    return { needsStatusMapping: !statusesMatch, needsSectionMapping: !sectionsMatch };
  }, [board, isBoardTemplate, template.statusOptions, template.sectionOptions]);

  const needsMapping = needsStatusMapping || needsSectionMapping;

  const handleNext = () => {
    if (step === 'select_board') {
      if (needsStatusMapping) {
        setStep('map_statuses');
      } else if (needsSectionMapping) {
        setStep('map_sections');
      } else {
        setStep('confirm');
      }
    } else if (step === 'map_statuses') {
      if (needsSectionMapping) {
        setStep('map_sections');
      } else {
        setStep('confirm');
      }
    } else if (step === 'map_sections') {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      if (needsSectionMapping) {
        setStep('map_sections');
      } else if (needsStatusMapping) {
        setStep('map_statuses');
      } else {
        setStep('select_board');
      }
    } else if (step === 'map_sections') {
      if (needsStatusMapping) {
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
            {step === 'map_statuses' && 'Map template statuses to the board.'}
            {step === 'map_sections' && 'Map template sections to the board.'}
            {step === 'confirm' && '\u00A0'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Select board */}
          {step === 'select_board' && (
            <div className="space-y-2">
              <Popover open={boardPickerOpen} onOpenChange={setBoardPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={boardPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {boardId
                      ? (() => {
                          const selected = standardBoards.find((b) => b.id === boardId);
                          return selected
                            ? `${selected.clientName ? `${selected.clientName} / ` : ''}${selected.name}`
                            : 'Select a board...';
                        })()
                      : 'Select a board...'}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search boards..." />
                    <CommandList>
                      <CommandEmpty>No boards found.</CommandEmpty>
                      <CommandGroup>
                        {standardBoards.map((b) => {
                          const label = `${b.clientName ? `${b.clientName} / ` : ''}${b.name}`;
                          return (
                            <CommandItem
                              key={b.id}
                              value={label}
                              onSelect={() => {
                                setBoardId(b.id);
                                setBoardPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 size-4',
                                  boardId === b.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Step 2: Map statuses */}
          {step === 'map_statuses' && (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
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
            </ScrollArea>
          )}

          {/* Step 3: Map sections */}
          {step === 'map_sections' && (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
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
            </ScrollArea>
          )}

          {/* Step 4: Confirm */}
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
