'use client';

import * as React from 'react';
import { CalendarIcon, CircleDot, LayoutGrid } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface TemplateQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  defaultStatus?: string | null;
  isPending?: boolean;
  onSubmit: (data: {
    title: string;
    description?: string;
    status: string | null;
    section: string | null;
    relativeDueDays: number | null;
  }) => void;
}

export function TemplateQuickAddDialog({
  open,
  onOpenChange,
  statusOptions,
  sectionOptions,
  defaultStatus,
  isPending,
  onSubmit,
}: TemplateQuickAddDialogProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<string | null>(null);
  const [dueDays, setDueDays] = React.useState('');

  const [statusDropdownOpen, setStatusDropdownOpen] = React.useState(false);
  const [sectionDropdownOpen, setSectionDropdownOpen] = React.useState(false);

  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const sectionDropdownRef = React.useRef<HTMLDivElement>(null);

  const sorted = React.useMemo(
    () => [...statusOptions].sort((a, b) => a.position - b.position),
    [statusOptions]
  );

  const sortedSections = React.useMemo(
    () => [...sectionOptions].sort((a, b) => a.position - b.position),
    [sectionOptions]
  );

  // Set default status when dialog opens
  React.useEffect(() => {
    if (open) {
      setStatus(defaultStatus ?? sorted[0]?.id ?? null);
    }
  }, [open, defaultStatus, sorted]);

  // Close dropdowns on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false);
      }
    }
    if (statusDropdownOpen || sectionDropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [statusDropdownOpen, sectionDropdownOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(null);
    setSection(null);
    setDueDays('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      section,
      relativeDueDays: dueDays !== '' ? parseInt(dueDays, 10) : null,
    });
    resetForm();
  };

  const currentStatus = sorted.find((s) => s.id === status);
  const currentSection = sortedSections.find((s) => s.id === section);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-3 overflow-hidden" style={{ maxWidth: '48vw', minWidth: '360px' }} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base">Add Task</DialogTitle>
        </DialogHeader>

        {/* Title */}
        <Input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          autoFocus
        />

        {/* Description */}
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
          placeholder="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Footer: dropdowns + actions */}
        <DialogFooter className="!flex-row !justify-start items-center gap-1 flex-wrap">
          {/* Status selector */}
          <div ref={statusDropdownRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setStatusDropdownOpen(!statusDropdownOpen);
                setSectionDropdownOpen(false);
              }}
              className="gap-1 text-xs h-8 px-2"
            >
              {currentStatus ? (
                <>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentStatus.color }}
                  />
                  {currentStatus.label}
                </>
              ) : (
                <>
                  <CircleDot className="h-3.5 w-3.5" />
                  Status
                </>
              )}
            </Button>

            {statusDropdownOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-md border bg-popover shadow-lg py-1">
                {sorted.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                      opt.id === status && 'bg-accent/50 font-medium'
                    )}
                    onClick={() => {
                      setStatus(opt.id);
                      setStatusDropdownOpen(false);
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section selector */}
          {sortedSections.length > 0 && (
            <div ref={sectionDropdownRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setSectionDropdownOpen(!sectionDropdownOpen);
                  setStatusDropdownOpen(false);
                }}
                className="gap-1 text-xs h-8 px-2"
              >
                {currentSection ? (
                  <>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: currentSection.color }}
                    />
                    {currentSection.label}
                  </>
                ) : (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Section
                  </>
                )}
              </Button>

              {sectionDropdownOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-md border bg-popover shadow-lg py-1">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                      !section && 'bg-accent/50 font-medium'
                    )}
                    onClick={() => {
                      setSection(null);
                      setSectionDropdownOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">None</span>
                  </button>
                  {sortedSections.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                        opt.id === section && 'bg-accent/50 font-medium'
                      )}
                      onClick={() => {
                        setSection(opt.id);
                        setSectionDropdownOpen(false);
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Relative due days */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className={cn(
                'gap-1 text-xs h-8 px-2',
                dueDays !== '' && 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/20'
              )}
              asChild
            >
              <label>
                <CalendarIcon className="h-3.5 w-3.5" />
                <input
                  type="number"
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Days"
                  className="w-12 bg-transparent outline-none placeholder:text-current [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </label>
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" type="button" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!title.trim() || isPending}
              onClick={handleSubmit}
            >
              {isPending ? 'Adding...' : 'Add task'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
