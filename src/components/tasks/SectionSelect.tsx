'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { SectionOption } from '@/lib/db/schema';

interface SectionSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SectionOption[];
  disabled?: boolean;
  placeholder?: string;
}

export function SectionSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '',
}: SectionSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((opt) => opt.id === value);

  if (options.length === 0) {
    return placeholder ? (
      <span className="text-sm text-muted-foreground">
        {placeholder}
      </span>
    ) : null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded transition-opacity',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          {selectedOption ? (
            <SectionBadge
              label={selectedOption.label}
              color={selectedOption.color}
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {placeholder}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none'
              )}
            >
              <X className="size-3" />
              <span>Clear section</span>
            </button>
          )}
          {options
            .sort((a, b) => a.position - b.position)
            .map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  value === option.id && 'bg-accent'
                )}
              >
                <span
                  className="size-3 shrink-0 rounded"
                  style={{ backgroundColor: option.color }}
                />
                <span className="flex-1 text-left">{option.label}</span>
                {value === option.id && (
                  <Check className="size-4 text-muted-foreground" />
                )}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SectionBadgeProps {
  label: string;
  color: string;
  className?: string;
}

export function SectionBadge({ label, color, className }: SectionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border font-normal', className)}
      style={{
        borderColor: color,
        color: color,
      }}
    >
      {label}
    </Badge>
  );
}
