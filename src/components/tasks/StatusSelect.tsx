'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { StatusOption } from '@/lib/db/schema';

interface StatusSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: StatusOption[];
  disabled?: boolean;
  size?: 'sm' | 'default';
}

export function StatusSelect({
  value,
  onChange,
  options,
  disabled = false,
  size = 'default',
}: StatusSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-full transition-opacity',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <StatusBadge
            label={selectedOption?.label ?? 'Select status'}
            color={selectedOption?.color ?? '#6B7280'}
            size={size}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-0.5">
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
                  className="size-3 shrink-0 rounded-full"
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

interface StatusBadgeProps {
  label: string;
  color: string;
  size?: 'sm' | 'default';
  className?: string;
}

export function StatusBadge({ label, color, size = 'default', className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-0 font-medium',
        size === 'sm' && 'px-1.5 py-0 text-xs',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      <span
        className={cn(
          'rounded-full',
          size === 'sm' ? 'size-1.5' : 'size-2'
        )}
        style={{ backgroundColor: color }}
      />
      {label}
    </Badge>
  );
}
