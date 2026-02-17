import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, type ShortcutConfig } from '@/lib/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const dispatchKeyEvent = (key: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...options,
    });
    document.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call handler when shortcut key is pressed', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('n');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not call handler when different key is pressed', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('m');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle shift modifier', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: '?', shift: true, description: 'Help', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without shift - should not trigger
    dispatchKeyEvent('?');
    expect(handler).not.toHaveBeenCalled();

    // With shift - should trigger
    dispatchKeyEvent('?', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle ctrl/meta modifier', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 's', ctrl: true, description: 'Save', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Without ctrl - should not trigger
    dispatchKeyEvent('s');
    expect(handler).not.toHaveBeenCalled();

    // With ctrl - should trigger
    dispatchKeyEvent('s', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when disabled', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }));

    dispatchKeyEvent('n');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should ignore input when ignoreInputs is true (default)', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler },
    ];

    // Create an input and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('n');

    expect(handler).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(input);
  });

  it('should trigger on input when ignoreInputs is false', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'Escape', description: 'Close', handler, ignoreInputs: false },
    ];

    // Create an input and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('Escape');

    expect(handler).toHaveBeenCalledTimes(1);

    // Cleanup
    document.body.removeChild(input);
  });

  it('should handle multiple shortcuts', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler: handler1 },
      { key: '/', description: 'Search', handler: handler2 },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('n');
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    dispatchKeyEvent('/');
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should clean up event listeners on unmount', () => {
    const handler = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: 'n', description: 'New task', handler },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatchKeyEvent('n');
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();

    dispatchKeyEvent('n');
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
  });
});
