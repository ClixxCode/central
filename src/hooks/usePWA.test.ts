import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePWA } from './usePWA';

describe('usePWA', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;
  const originalMatchMedia = global.matchMedia;

  beforeEach(() => {
    // Mock matchMedia
    Object.defineProperty(global, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: {
        onLine: true,
        standalone: undefined,
      },
    });

    // Mock addEventListener and removeEventListener
    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: originalNavigator,
    });
    Object.defineProperty(global, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('should return initial online status', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isOnline).toBe(true);
  });

  it('should detect standalone mode', () => {
    Object.defineProperty(global, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isStandalone).toBe(true);
    expect(result.current.isInstalled).toBe(true);
  });

  it('should detect iOS standalone mode', () => {
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: {
        onLine: true,
        standalone: true,
      },
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isStandalone).toBe(true);
  });

  it('should add event listeners on mount', () => {
    renderHook(() => usePWA());

    expect(global.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(global.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(global.addEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(global.addEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('should remove event listeners on unmount', () => {
    const { unmount } = renderHook(() => usePWA());

    unmount();

    expect(global.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(global.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(global.removeEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(global.removeEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('should update isOnline when online event fires', async () => {
    let onlineHandler: (() => void) | null = null;

    (global.addEventListener as ReturnType<typeof vi.fn>).mockImplementation((event, handler) => {
      if (event === 'online') {
        onlineHandler = handler as () => void;
      }
    });

    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: { onLine: false, standalone: undefined },
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isOnline).toBe(false);

    // Simulate going online
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: { onLine: true, standalone: undefined },
    });

    act(() => {
      onlineHandler?.();
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });
  });

  it('should set canInstall when beforeinstallprompt fires', async () => {
    let installPromptHandler: (() => void) | null = null;

    (global.addEventListener as ReturnType<typeof vi.fn>).mockImplementation((event, handler) => {
      if (event === 'beforeinstallprompt') {
        installPromptHandler = handler as () => void;
      }
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.canInstall).toBe(false);

    act(() => {
      installPromptHandler?.();
    });

    await waitFor(() => {
      expect(result.current.canInstall).toBe(true);
    });
  });
});
