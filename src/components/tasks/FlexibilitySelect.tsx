'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

interface FlexibilityOption {
  value: DateFlexibility;
  label: string;
  description: string;
  color: string;
}

const flexibilityOptions: FlexibilityOption[] = [
  {
    value: 'not_set',
    label: 'Not set',
    description: 'No flexibility preference',
    color: '#6B7280',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Date can be moved easily',
    color: '#10B981',
  },
  {
    value: 'semi_flexible',
    label: 'Semi-flexible',
    description: 'Can move with notice',
    color: '#F59E0B',
  },
  {
    value: 'not_flexible',
    label: 'Not flexible',
    description: 'Hard deadline',
    color: '#EF4444',
  },
];

interface FlexibilitySelectProps {
  value: DateFlexibility;
  onChange: (value: DateFlexibility) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function FlexibilitySelect({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: FlexibilitySelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = flexibilityOptions.find((opt) => opt.value === value)!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <FlexibilityIndicator flexibility={value} />
          {showLabel && (
            <span className="text-muted-foreground">{selectedOption.label}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="flex flex-col gap-0.5">
          {flexibilityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                value === option.value && 'bg-accent'
              )}
            >
              <FlexibilityIndicator flexibility={option.value} />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
              {value === option.value && (
                <Check className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FlexibilityIndicatorProps {
  flexibility: DateFlexibility;
  className?: string;
}

export function FlexibilityIndicator({
  flexibility,
  className,
}: FlexibilityIndicatorProps) {
  const option = flexibilityOptions.find((opt) => opt.value === flexibility)!;

  if (flexibility === 'not_set') {
    return (
      <span
        className={cn('size-2.5 rounded-full border-2 border-dashed', className)}
        style={{ borderColor: option.color }}
      />
    );
  }

  return (
    <span
      className={cn('size-2.5 rounded-full', className)}
      style={{ backgroundColor: option.color }}
    />
  );
}

export function getFlexibilityColor(flexibility: DateFlexibility): string {
  return flexibilityOptions.find((opt) => opt.value === flexibility)?.color ?? '#6B7280';
}

export function getFlexibilityLabel(flexibility: DateFlexibility): string {
  return flexibilityOptions.find((opt) => opt.value === flexibility)?.label ?? 'Not set';
}
