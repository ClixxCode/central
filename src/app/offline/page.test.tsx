import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfflinePage from './page';

describe('OfflinePage', () => {
  const originalNavigator = global.navigator;
  const originalLocation = global.location;

  beforeEach(() => {
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: { onLine: false },
    });

    Object.defineProperty(global, 'location', {
      writable: true,
      value: {
        reload: vi.fn(),
        href: '/',
      },
    });

    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: originalNavigator,
    });
    Object.defineProperty(global, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('should render offline message', () => {
    render(<OfflinePage />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('should render try again button', () => {
    render(<OfflinePage />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should reload page when try again is clicked', () => {
    render(<OfflinePage />);

    const button = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(button);

    expect(global.location.reload).toHaveBeenCalled();
  });

  it('should display what users can do while offline', () => {
    render(<OfflinePage />);

    expect(screen.getByText("While you're offline, you can:")).toBeInTheDocument();
    expect(screen.getByText(/view previously loaded tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/make changes that will sync/i)).toBeInTheDocument();
  });

  it('should add event listeners for online/offline events', () => {
    render(<OfflinePage />);

    expect(global.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(global.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should remove event listeners on unmount', () => {
    const { unmount } = render(<OfflinePage />);

    unmount();

    expect(global.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(global.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
