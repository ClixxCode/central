'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY_PREFIX = 'table-col-widths';
const SYNC_EVENT = 'column-widths-sync';

const DEFAULT_WIDTHS: Record<string, number> = {
  source: 160,
  status: 128,
  section: 112,
  assignees: 112,
  dueDate: 144,
};

interface UseColumnResizeReturn {
  columnWidths: Record<string, number>;
  onResizeStart: (columnKey: string, e: React.MouseEvent) => void;
  isResizing: boolean;
}

function getStorageKey(userId: string | undefined): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

function readWidths(userId: string | undefined): Record<string, number> {
  if (typeof window === 'undefined') return DEFAULT_WIDTHS;
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_WIDTHS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDTHS;
}

// Broadcast width changes to other hook instances on the same page
function broadcastWidths(widths: Record<string, number>, sourceId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { widths, sourceId } }));
}

export function useColumnResize(): UseColumnResizeReturn {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => readWidths(userId)
  );
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Unique ID for this hook instance to avoid self-updates
  const instanceId = useRef(Math.random().toString(36).slice(2));

  // When userId becomes available, re-read from the correct key
  const initializedForUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (userId && initializedForUser.current !== userId) {
      initializedForUser.current = userId;
      setColumnWidths(readWidths(userId));
    }
  }, [userId]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState.current) return;
    const { columnKey, startX, startWidth } = resizeState.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + delta);
    const next = { ...columnWidths, [columnKey]: newWidth };
    setColumnWidths(next);
    // Defer broadcast to avoid setState-during-render in sibling instances
    queueMicrotask(() => broadcastWidths(next, instanceId.current));
  }, [columnWidths]);

  const handleMouseUp = useCallback(() => {
    if (!resizeState.current) return;
    resizeState.current = null;
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Listen for width changes from other hook instances
  useEffect(() => {
    const handler = (e: Event) => {
      const { widths, sourceId } = (e as CustomEvent).detail;
      if (sourceId !== instanceId.current) {
        setColumnWidths(widths);
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  // Persist to localStorage when widths change and not currently resizing
  useEffect(() => {
    if (!isResizing) {
      try {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(columnWidths));
      } catch {
        // ignore
      }
    }
  }, [columnWidths, isResizing, userId]);

  // Attach/detach global listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const onResizeStart = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        columnKey,
        startX: e.clientX,
        startWidth: columnWidths[columnKey] ?? DEFAULT_WIDTHS[columnKey] ?? 128,
      };
      setIsResizing(true);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [columnWidths]
  );

  return { columnWidths, onResizeStart, isResizing };
}
