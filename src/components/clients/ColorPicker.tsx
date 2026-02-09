'use client';

import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  // Row 1: Warm
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  // Row 2: Cool
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  // Row 3: Neutral
  '#F43F5E', '#64748B', '#78716C', '#71717A', '#737373', '#6B7280', '#9CA3AF', '#334155',
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const isPreset = PRESET_COLORS.some(
    (c) => c.toUpperCase() === value.toUpperCase()
  );

  const handleHexInput = (input: string) => {
    const raw = input.replace(/^#/, '');
    const cleaned = raw.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    if (cleaned.length > 0) {
      onChange(`#${cleaned.toUpperCase()}`);
    }
  };

  const hexDisplay = value.replace(/^#/, '');

  return (
    <div className="space-y-2">
      {/* Preset color grid */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}
      >
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-7 rounded-md transition-all ${
              value.toUpperCase() === c.toUpperCase()
                ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                : 'hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Custom color row */}
      <div className="flex items-center gap-2">
        {/* Toggle button for the color picker */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className={`w-8 h-8 rounded-lg shrink-0 transition-all hover:scale-105 ${
            !isPreset ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
          }`}
          style={{
            background: isPreset
              ? 'conic-gradient(from 0deg, #EF4444, #F97316, #F59E0B, #22C55E, #06B6D4, #3B82F6, #8B5CF6, #EC4899, #EF4444)'
              : value,
          }}
          title="Pick custom color"
        />

        {/* Hex input */}
        <div className="flex items-center">
          <span className="text-sm text-muted-foreground font-mono">#</span>
          <Input
            value={hexDisplay}
            onChange={(e) => handleHexInput(e.target.value)}
            onFocus={() => setShowPicker(true)}
            className="w-[5.5rem] h-8 font-mono text-sm px-1"
            maxLength={6}
            placeholder="3B82F6"
          />
        </div>
      </div>

      {/* Inline color picker */}
      {showPicker && (
        <div className="[&_.react-colorful]:w-full [&_.react-colorful]:h-[120px]">
          <HexColorPicker
            color={value.length === 7 ? value : '#000000'}
            onChange={(c) => onChange(c.toUpperCase())}
          />
        </div>
      )}
    </div>
  );
}

export { PRESET_COLORS };
