'use client';

import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  TriggerPopover,
  type TriggerMode,
  type BoardSelection,
  type UserSelection,
  type DateSelection,
  type StatusSelection,
} from './TriggerPopover';

export interface PasteItem {
  title: string;
  isSubtask: boolean;
}

export interface InputPill {
  type: 'board' | 'assignee' | 'date' | 'status';
  id: string;
  label: string;
  data: BoardSelection | UserSelection | DateSelection | StatusSelection;
}

interface SmartTaskInputProps {
  onTitleChange: (title: string) => void;
  onBoardSelect: (board: BoardSelection) => void;
  onUserSelect: (user: UserSelection) => void;
  onDateSelect: (date: DateSelection) => void;
  onStatusSelect: (status: StatusSelection) => void;
  onBoardRemove: () => void;
  onUserRemove: (userId: string) => void;
  onDateRemove: () => void;
  onStatusRemove: () => void;
  onSubmit?: () => void;
  onMultiLinePaste?: (items: PasteItem[]) => void;
  hasBoardSelected?: boolean;
  selectedBoardId?: string;
  statusOptions?: { id: string; label: string; color: string; position: number }[];
  pills: InputPill[];
  placeholder?: string;
  autoFocus?: boolean;
}

export function SmartTaskInput({
  onTitleChange,
  onBoardSelect,
  onUserSelect,
  onDateSelect,
  onStatusSelect,
  onBoardRemove,
  onUserRemove,
  onDateRemove,
  onStatusRemove,
  onSubmit,
  onMultiLinePaste,
  hasBoardSelected,
  selectedBoardId,
  statusOptions,
  pills,
  placeholder = 'Task name... use # board, @ assignee, ! date, + status',
  autoFocus = true,
}: SmartTaskInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [trigger, setTrigger] = React.useState<{
    mode: TriggerMode;
    query: string;
    position: { top: number; left: number };
  } | null>(null);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Extract clean title from contenteditable (text nodes only, skip pills)
  const extractTitle = useCallback(() => {
    if (!editorRef.current) return '';
    let text = '';
    for (const node of Array.from(editorRef.current.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? '';
      }
      // Skip pill spans
    }
    return text.trim();
  }, []);

  // Detect trigger character by walking backward from cursor
  const detectTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) {
      setTrigger(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    // Only detect in text nodes
    if (node.nodeType !== Node.TEXT_NODE) {
      setTrigger(null);
      return;
    }

    const text = node.textContent ?? '';
    const cursorPos = range.startOffset;

    // Walk backward to find trigger character
    let triggerPos = -1;
    let triggerChar: TriggerMode | null = null;

    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '#' || ch === '@' || ch === '!' || ch === '+') {
        // Must be preceded by whitespace or at start
        if (i === 0 || /\s/.test(text[i - 1])) {
          triggerPos = i;
          triggerChar = ch as TriggerMode;
        }
        break;
      }
      // Stop at whitespace (except for ! which allows spaces in date queries)
      if (/\s/.test(ch) && triggerChar !== '!') {
        // Check if we already found a ! before this space
        break;
      }
    }

    // Special handling for ! trigger - allow spaces in date queries like "next week"
    if (!triggerChar) {
      for (let i = cursorPos - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '!') {
          if (i === 0 || /\s/.test(text[i - 1])) {
            triggerPos = i;
            triggerChar = '!';
          }
          break;
        }
      }
    }

    if (triggerChar === null || triggerPos === -1) {
      setTrigger(null);
      return;
    }

    const query = text.slice(triggerPos + 1, cursorPos);

    // Get position for popover relative to the editor container
    const tempRange = document.createRange();
    tempRange.setStart(node, triggerPos);
    tempRange.setEnd(node, triggerPos + 1);
    const triggerRect = tempRange.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    setTrigger({
      mode: triggerChar,
      query,
      position: {
        top: triggerRect.bottom - editorRect.top,
        left: triggerRect.left - editorRect.left,
      },
    });
  }, []);

  const handleInput = useCallback(() => {
    onTitleChange(extractTitle());
    detectTrigger();
  }, [onTitleChange, extractTitle, detectTrigger]);

  // Handle backspace to remove pills
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editorRef.current) return;

        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const node = range.startContainer;
        const offset = range.startOffset;

        // Check if we're at the start of a text node right after a pill
        if (node.nodeType === Node.TEXT_NODE && offset === 0) {
          const prevSibling = node.previousSibling;
          if (prevSibling && prevSibling instanceof HTMLElement && prevSibling.dataset.pillType) {
            e.preventDefault();
            const pillType = prevSibling.dataset.pillType;
            const pillId = prevSibling.dataset.pillId ?? '';
            prevSibling.remove();

            if (pillType === 'board') onBoardRemove();
            else if (pillType === 'assignee') onUserRemove(pillId);
            else if (pillType === 'date') onDateRemove();
            else if (pillType === 'status') onStatusRemove();

            onTitleChange(extractTitle());
            return;
          }
        }

        // Check if cursor is in the editor root and before a pill
        if (node === editorRef.current) {
          const child = editorRef.current.childNodes[offset - 1];
          if (child && child instanceof HTMLElement && child.dataset.pillType) {
            e.preventDefault();
            const pillType = child.dataset.pillType;
            const pillId = child.dataset.pillId ?? '';
            child.remove();

            if (pillType === 'board') onBoardRemove();
            else if (pillType === 'assignee') onUserRemove(pillId);
            else if (pillType === 'date') onDateRemove();
            else if (pillType === 'status') onStatusRemove();

            onTitleChange(extractTitle());
          }
        }
      }

      // Don't propagate Enter/ArrowDown/ArrowUp when popover is open
      if (trigger && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        return;
      }

      // Enter with no popover open → submit
      if (e.key === 'Enter' && !trigger && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [trigger, onBoardRemove, onUserRemove, onDateRemove, onStatusRemove, onTitleChange, extractTitle, onSubmit]
  );

  // Intercept multi-line pastes
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!onMultiLinePaste || !hasBoardSelected) return;

      const text = e.clipboardData.getData('text/plain');
      const rawLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (rawLines.length < 2) return;

      e.preventDefault();

      const listMarkerRe = /^[-*+]|\d+[.)]\s*/;

      // Check if the list is mixed (some lines have markers, some don't).
      // In a mixed list, bare lines are parents and bulleted lines are subtasks.
      const trimmedLines = rawLines.map((l) => l.trim());
      const hasBulleted = trimmedLines.some((l) => listMarkerRe.test(l));
      const hasPlain = trimmedLines.some((l) => !listMarkerRe.test(l));
      const isMixedList = hasBulleted && hasPlain;

      const items: PasteItem[] = [];
      let lastParentIndex = -1;

      for (const raw of rawLines) {
        const trimmed = raw.trim();

        // Measure leading whitespace (tabs count as 2 spaces)
        const leadingMatch = raw.match(/^(\s*)/);
        const leading = leadingMatch ? leadingMatch[1].replace(/\t/g, '  ') : '';
        const indentLevel = leading.length;

        const hasMarker = listMarkerRe.test(trimmed);

        // Clean the line: strip list markers and trim
        const cleaned = trimmed
          .replace(/^(?:[-*+]|\d+[.)]\s*|#{1,6}\s+)\s*/, '')
          .trim();

        if (!cleaned) continue;

        // A line is a subtask if:
        // 1. It has leading whitespace (explicit indentation), OR
        // 2. It has a list marker in a mixed list (bullet under a plain parent)
        const isSubtask =
          lastParentIndex >= 0 &&
          (indentLevel > 0 || (isMixedList && hasMarker));

        if (!isSubtask) {
          lastParentIndex = items.length;
        }

        items.push({ title: cleaned, isSubtask });
      }

      if (items.length >= 2) {
        onMultiLinePaste(items);
      }
    },
    [onMultiLinePaste, hasBoardSelected]
  );

  // Insert a pill span replacing the trigger text
  const insertPill = useCallback(
    (type: 'board' | 'assignee' | 'date' | 'status', id: string, label: string, colorClasses: string) => {
      if (!editorRef.current || !trigger) return;

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;

      const text = node.textContent ?? '';
      const cursorPos = range.startOffset;

      // Find the trigger position in the text
      let triggerPos = -1;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === trigger.mode) {
          triggerPos = i;
          break;
        }
      }
      if (triggerPos === -1) return;

      // Split text node: before trigger, trigger+query, after cursor
      const before = text.slice(0, triggerPos);
      const after = text.slice(cursorPos);

      // Create pill span
      const pill = document.createElement('span');
      pill.contentEditable = 'false';
      pill.dataset.pillType = type;
      pill.dataset.pillId = id;
      pill.className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium mx-0.5 ${colorClasses}`;
      pill.textContent = label;

      // Replace content
      const parent = node.parentNode!;
      const beforeNode = document.createTextNode(before);
      const afterNode = document.createTextNode(after ? after : '\u00A0');

      parent.replaceChild(afterNode, node);
      parent.insertBefore(pill, afterNode);
      parent.insertBefore(beforeNode, pill);

      // Place cursor after the pill
      const newRange = document.createRange();
      newRange.setStart(afterNode, after ? 0 : 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      setTrigger(null);
      onTitleChange(extractTitle());
    },
    [trigger, onTitleChange, extractTitle]
  );

  const handleBoardSelect = useCallback(
    (board: BoardSelection) => {
      insertPill('board', board.boardId, `${board.clientName} / ${board.boardName}`, 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300');
      onBoardSelect(board);
    },
    [insertPill, onBoardSelect]
  );

  const handleUserSelect = useCallback(
    (user: UserSelection) => {
      insertPill('assignee', user.id, user.name ?? user.email, 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300');
      onUserSelect(user);
    },
    [insertPill, onUserSelect]
  );

  const handleDateSelect = useCallback(
    (date: DateSelection) => {
      insertPill('date', 'due-date', date.label, 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300');
      onDateSelect(date);
    },
    [insertPill, onDateSelect]
  );

  const handleStatusSelect = useCallback(
    (status: StatusSelection) => {
      insertPill('status', status.id, status.label, 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300');
      onStatusSelect(status);
    },
    [insertPill, onStatusSelect]
  );

  return (
    <div className={cn('relative', trigger && 'z-50')}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          'min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground'
        )}
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        role="textbox"
        aria-label="Task name"
      />

      {trigger && (
        <TriggerPopover
          mode={trigger.mode}
          query={trigger.query}
          position={trigger.position}
          selectedBoardId={selectedBoardId}
          statusOptions={statusOptions}
          onSelectBoard={handleBoardSelect}
          onSelectUser={handleUserSelect}
          onSelectDate={handleDateSelect}
          onSelectStatus={handleStatusSelect}
          onClose={() => setTrigger(null)}
        />
      )}
    </div>
  );
}
