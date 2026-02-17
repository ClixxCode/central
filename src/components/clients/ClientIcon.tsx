'use client';

import { cn } from '@/lib/utils';
import { VALID_ICONS } from './icon-data';

const SIZES = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
} as const;

interface ClientIconProps {
  icon: string | null | undefined;
  color?: string | null;
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function ClientIcon({
  icon,
  color,
  name,
  size = 'sm',
  className,
}: ClientIconProps) {
  const fontSize = SIZES[size];

  // Fallback to 'circle' if icon is missing or not in our validated set
  const resolvedIcon = icon && VALID_ICONS.has(icon) ? icon : 'circle';

  return (
    <span
      className={cn('material-symbols-outlined leading-none shrink-0', className)}
      style={{
        color: color ?? undefined,
        fontSize,
      }}
    >
      {resolvedIcon}
    </span>
  );
}
