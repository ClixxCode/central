'use client';

import { useEffect, useCallback, useRef } from 'react';

type ShortcutHandler = () => void;

interface ShortcutConfig {
  /** Single key or array of keys for sequence (e.g., ['g', 'b'] for g then b) */
  key: string | string[];
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: ShortcutHandler;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Only trigger when not in an input/textarea */
  ignoreInputs?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /** Enable/disable all shortcuts */
  enabled?: boolean;
  /** Timeout for key sequences in ms (default: 500) */
  sequenceTimeout?: number;
}

const isInputElement = (element: Element | null): boolean => {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  );
};

// Global key sequence buffer
let keySequence: string[] = [];
let sequenceTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, sequenceTimeout = 500 } = options;
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref updated
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      
      // Ignore modifier keys alone
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;

      const pressedKey = event.key.toLowerCase();
      
      // Add key to sequence buffer
      keySequence.push(pressedKey);
      
      // Clear previous timeout and set new one
      if (sequenceTimeoutId) {
        clearTimeout(sequenceTimeoutId);
      }
      sequenceTimeoutId = setTimeout(() => {
        keySequence = [];
      }, sequenceTimeout);

      for (const shortcut of shortcutsRef.current) {
        const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
        const isSequence = keys.length > 1;
        
        // For sequences, check if the current sequence matches
        if (isSequence) {
          const sequenceMatches = keys.every((key, index) => 
            keySequence[keySequence.length - keys.length + index]?.toLowerCase() === key.toLowerCase()
          );
          
          if (sequenceMatches && keySequence.length >= keys.length) {
            // Check if we should ignore when in input
            if (shortcut.ignoreInputs !== false && isInputElement(document.activeElement)) {
              continue;
            }

            if (shortcut.preventDefault !== false) {
              event.preventDefault();
            }

            // Clear sequence after match
            keySequence = [];
            if (sequenceTimeoutId) clearTimeout(sequenceTimeoutId);
            
            shortcut.handler();
            return;
          }
        } else {
          // Single key shortcut
          const keyMatch = pressedKey === keys[0].toLowerCase();
          const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
          const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
          const altMatch = shortcut.alt ? event.altKey : !event.altKey;

          if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
            // Check if we should ignore when in input
            if (shortcut.ignoreInputs !== false && isInputElement(document.activeElement)) {
              continue;
            }

            // Don't trigger single-key shortcuts if we're in the middle of a potential sequence
            // (except for the first key which starts the sequence)
            const isStartOfSequence = shortcutsRef.current.some(s => {
              const sKeys = Array.isArray(s.key) ? s.key : [s.key];
              return sKeys.length > 1 && sKeys[0].toLowerCase() === pressedKey;
            });
            
            if (isStartOfSequence && keySequence.length === 1) {
              // This could be the start of a sequence, wait for more keys
              continue;
            }

            if (shortcut.preventDefault !== false) {
              event.preventDefault();
            }

            shortcut.handler();
            return;
          }
        }
      }
    },
    [enabled, sequenceTimeout]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Pre-defined shortcut definitions for help display
export const SHORTCUT_DEFINITIONS = [
  { key: 'n', description: 'Create new task', category: 'Tasks' },
  { key: 'Shift plus Click', description: 'Select multiple tasks', category: 'Tasks' },
  { key: '/', description: 'Focus search', category: 'Navigation' },
  { key: 'b / t / c', description: 'Filter search by boards / tasks / clients', category: 'Navigation' },
  { key: ['g', 't'], description: 'Go to My Tasks', category: 'Navigation' },
  { key: ['g', 'p'], description: 'Go to Personal Tasks', category: 'Navigation' },
  { key: ['g', 'm'], description: 'Go to Replies & Mentions', category: 'Navigation' },
  { key: 'f plus 1-9', description: 'Go To Pinned Favorite (1–9)', category: 'Navigation' },
  { key: ['g', 's'], description: 'Go to Settings', category: 'General' },
  { key: 'Escape', description: 'Close modal or cancel', category: 'General' },
  { key: '?', description: 'Show keyboard shortcuts', category: 'Help' },
] as const;

/** Format a shortcut key for display */
export function formatShortcutKey(key: string | string[]): string {
  if (Array.isArray(key)) {
    return key.join(' then ');
  }
  return key;
}

export type { ShortcutConfig, ShortcutHandler };
