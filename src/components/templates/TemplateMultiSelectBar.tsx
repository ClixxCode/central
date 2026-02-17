'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, FolderOpen, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SectionOption } from '@/lib/db/schema';

export interface TemplateBulkEditPayload {
  section?: string | null;
  relativeDueDays?: number | null;
}

interface TemplateMultiSelectBarProps {
  selectedCount: number;
  sectionOptions: SectionOption[];
  onApply: (updates: TemplateBulkEditPayload) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function TemplateMultiSelectBar({
  selectedCount,
  sectionOptions,
  onApply,
  onCancel,
  isPending,
}: TemplateMultiSelectBarProps) {
  const [pendingSection, setPendingSection] = React.useState<string | null | undefined>();
  const [pendingDueDays, setPendingDueDays] = React.useState<number | null | undefined>();

  const [sectionOpen, setSectionOpen] = React.useState(false);
  const [dueDaysOpen, setDueDaysOpen] = React.useState(false);
  const [dueDaysInput, setDueDaysInput] = React.useState('');

  const sectionRef = React.useRef<HTMLDivElement>(null);
  const dueDaysRef = React.useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setSectionOpen(false);
    setDueDaysOpen(false);
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const refs = [sectionRef, dueDaysRef];
      const clickedInside = refs.some(
        (ref) => ref.current?.contains(e.target as Node)
      );
      if (!clickedInside) closeAll();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasEdits = pendingSection !== undefined || pendingDueDays !== undefined;

  const handleApply = () => {
    const payload: TemplateBulkEditPayload = {};
    if (pendingSection !== undefined) payload.section = pendingSection;
    if (pendingDueDays !== undefined) payload.relativeDueDays = pendingDueDays;
    onApply(payload);
  };

  const currentSection = sectionOptions.find((s) => s.id === pendingSection);

  const formatDueDays = (days: number | null) => {
    if (days == null) return 'Clear';
    if (days > 0) return `+${days}d`;
    if (days === 0) return '0d';
    return `${days}d`;
  };

  const handleDueDaysSet = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setPendingDueDays(num);
      setDueDaysInput(String(num));
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', bottom: '48px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
      <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-2xl">
        {/* Section picker */}
        <div ref={sectionRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setSectionOpen(!sectionOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              pendingSection !== undefined && 'border-green-300 text-green-700 bg-green-50 dark:border-green-500/30 dark:text-green-300 dark:bg-green-500/20'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {currentSection ? currentSection.label : pendingSection === null ? 'No section' : 'Section'}
          </Button>

          {sectionOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[160px] rounded-md border bg-popover shadow-lg py-1">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                  pendingSection === null && 'bg-accent/50 font-medium'
                )}
                onClick={() => {
                  setPendingSection(null);
                  setSectionOpen(false);
                }}
              >
                <span className="text-muted-foreground">No section</span>
              </button>
              {sectionOptions.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                    pendingSection === section.id && 'bg-accent/50 font-medium'
                  )}
                  onClick={() => {
                    setPendingSection(section.id);
                    setSectionOpen(false);
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Relative due days picker */}
        <div ref={dueDaysRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setDueDaysOpen(!dueDaysOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              pendingDueDays !== undefined && 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/20'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {pendingDueDays !== undefined ? formatDueDays(pendingDueDays) : 'Due Days'}
          </Button>

          {dueDaysOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-[200px] rounded-md border bg-popover shadow-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    const current = pendingDueDays ?? 0;
                    setPendingDueDays(current - 1);
                    setDueDaysInput(String(current - 1));
                  }}
                >
                  <Minus className="size-3" />
                </Button>
                <Input
                  type="number"
                  value={dueDaysInput}
                  onChange={(e) => setDueDaysInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDueDaysSet(dueDaysInput);
                      setDueDaysOpen(false);
                    }
                  }}
                  onBlur={() => handleDueDaysSet(dueDaysInput)}
                  placeholder="0"
                  className="h-7 text-center text-sm"
                  autoFocus
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    const current = pendingDueDays ?? 0;
                    setPendingDueDays(current + 1);
                    setDueDaysInput(String(current + 1));
                  }}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-7 flex-1 text-xs text-muted-foreground"
                  onClick={() => {
                    setPendingDueDays(null);
                    setDueDaysInput('');
                    setDueDaysOpen(false);
                  }}
                >
                  <X className="size-3 mr-1" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  type="button"
                  className="h-7 flex-1 text-xs"
                  onClick={() => {
                    handleDueDaysSet(dueDaysInput);
                    setDueDaysOpen(false);
                  }}
                >
                  Set
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* Count + Actions */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {selectedCount} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasEdits || isPending}
          className="text-xs h-8"
        >
          {isPending ? 'Applying...' : 'Apply Edits'}
        </Button>
      </div>
    </div>,
    document.body
  );
}
