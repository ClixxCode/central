'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SubtaskOnlyFloatingBarProps {
  onExit: () => void;
  bottomOffset?: string;
}

export function SubtaskOnlyFloatingBar({
  onExit,
  bottomOffset,
}: SubtaskOnlyFloatingBarProps) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: bottomOffset ?? '48px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
    >
      <button
        type="button"
        onClick={onExit}
        className="inline-flex h-10 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium shadow-2xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Exit subtask only mode"
      >
        <span>Exit subtask only mode</span>
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>,
    document.body
  );
}
