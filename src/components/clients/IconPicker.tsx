'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ICON_CATEGORIES, ALL_ICONS } from './icon-data';

// Build search index: icon name (with spaces) + category label
const ICON_SEARCH_INDEX = new Map<string, string>();
for (const category of ICON_CATEGORIES) {
  for (const icon of category.icons) {
    ICON_SEARCH_INDEX.set(
      icon,
      `${icon.replace(/_/g, ' ')} ${category.label.toLowerCase()}`
    );
  }
}

function useFontReady(fontFamily: string) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        return document.fonts.check(`24px "${fontFamily}"`);
      } catch {
        return false;
      }
    };
    if (check()) {
      setReady(true);
      return;
    }
    document.fonts.ready.then(() => setReady(check()));
  }, [fontFamily]);
  return ready;
}

/** Renders a category only when it scrolls near the viewport */
function LazyCategory({
  category,
  value,
  onChange,
  color,
  fontReady,
}: {
  category: { label: string; icons: string[] };
  value: string | null;
  onChange: (icon: string) => void;
  color?: string;
  fontReady: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Estimate height: label ~24px + icon rows. Each row ~40px, ~10 icons/row
  const estimatedRows = Math.ceil(category.icons.length / 10);
  const estimatedHeight = 24 + estimatedRows * 40;

  return (
    <div ref={ref}>
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {category.label}
      </p>
      {visible && fontReady ? (
        <div className="flex gap-1.5 flex-wrap">
          {category.icons.map((icon) => (
            <IconButton
              key={icon}
              icon={icon}
              selected={value === icon}
              color={color}
              onClick={() => onChange(icon)}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex gap-1.5 flex-wrap"
          style={{ minHeight: estimatedHeight }}
        >
          {Array.from({ length: Math.min(category.icons.length, 20) }).map((_, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({
  icon,
  selected,
  color,
  onClick,
}: {
  icon: string;
  selected: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center transition-all border',
        selected
          ? 'ring-2 ring-offset-1 ring-foreground border-foreground scale-110'
          : 'border-transparent hover:bg-accent hover:scale-105'
      )}
      title={icon.replace(/_/g, ' ')}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 22, color: color ?? undefined }}
      >
        {icon}
      </span>
    </button>
  );
}

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string) => void;
  color?: string;
}

export function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const fontReady = useFontReady('Material Symbols Outlined');

  const filteredIcons = search
    ? ALL_ICONS.filter((icon) => {
        const q = search.toLowerCase();
        const searchable = ICON_SEARCH_INDEX.get(icon) ?? icon;
        return searchable.includes(q);
      })
    : null;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      {filteredIcons ? (
        <div className="flex gap-1.5 flex-wrap max-h-[300px] overflow-y-auto">
          {filteredIcons.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No icons found</p>
          )}
          {fontReady
            ? filteredIcons.map((icon) => (
                <IconButton
                  key={icon}
                  icon={icon}
                  selected={value === icon}
                  color={color}
                  onClick={() => onChange(icon)}
                />
              ))
            : Array.from({ length: Math.min(filteredIcons.length, 30) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-lg bg-muted animate-pulse"
                  />
                )
              )}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {ICON_CATEGORIES.map((category) => (
            <LazyCategory
              key={category.label}
              category={category}
              value={value}
              onChange={onChange}
              color={color}
              fontReady={fontReady}
            />
          ))}
        </div>
      )}
    </div>
  );
}
