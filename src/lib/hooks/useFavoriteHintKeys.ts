'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Tracks whether the 'f' key is held down (for showing favorite number hints).
 * Only activates when not focused on an input/textarea/contentEditable element.
 */

let fKeyHeld = false;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return fKeyHeld;
}

function getServerSnapshot() {
  return false;
}

function setHeld(value: boolean) {
  if (fKeyHeld !== value) {
    fKeyHeld = value;
    listeners.forEach((l) => l());
  }
}

function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  );
}

// Set up global listeners once
let initialized = false;

function initListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInputElement(document.activeElement)) {
      setHeld(true);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'f') {
      setHeld(false);
    }
  });

  // Clear on blur (e.g. user switches tabs while holding f)
  window.addEventListener('blur', () => {
    setHeld(false);
  });
}

export function useFavoriteHintKeys(): boolean {
  useEffect(() => {
    initListeners();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
