'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SHORTCUT_DEFINITIONS, formatShortcutKey } from '@/lib/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutKeyProps {
  children: React.ReactNode;
}

function ShortcutKey({ children }: ShortcutKeyProps) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

// Parse shortcut keys - now handles string | string[]
function parseShortcutKeys(key: string | readonly string[]): React.ReactNode {
  const formatted = formatShortcutKey(key as string | string[]);
  
  if (formatted.includes(' then ')) {
    const parts = formatted.split(' then ');
    return (
      <span className="flex items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground text-xs">then</span>}
            <ShortcutKey>{part}</ShortcutKey>
          </span>
        ))}
      </span>
    );
  }
  return <ShortcutKey>{formatted}</ShortcutKey>;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  // Group shortcuts by category
  const groupedShortcuts = SHORTCUT_DEFINITIONS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, typeof SHORTCUT_DEFINITIONS[number][]>
  );

  const categories = Object.keys(groupedShortcuts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate faster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {groupedShortcuts[category].map((shortcut, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    {parseShortcutKeys(shortcut.key)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
