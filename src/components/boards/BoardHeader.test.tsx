import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardHeader } from './BoardHeader';
import type { TopShellContext } from '@/components/layout/shell-context';

const mocks = vi.hoisted(() => ({
  useTopShellContextOverride: vi.fn(),
}));

vi.mock('@/components/layout/top-shell-override', () => ({
  useTopShellContextOverride: mocks.useTopShellContextOverride,
}));

vi.mock('@/components/shared/FavoriteButton', () => ({
  FavoriteButton: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      Favorite board
    </button>
  ),
}));

describe('BoardHeader', () => {
  it('keeps parent project context out of breadcrumbs when shown as subtitle', () => {
    render(
      <BoardHeader
        boardId="board-1"
        boardName="Podcast"
        clientName="SWMW Law"
        clientSlug="swmw-law"
        canEdit
        parentBoard={{
          id: 'parent-board',
          name: 'Matter Projects',
          clientSlug: 'swmw-law',
        }}
      />
    );

    const calls = mocks.useTopShellContextOverride.mock.calls;
    const context = calls[calls.length - 1]?.[0] as TopShellContext;

    expect(context.breadcrumbs.map((crumb) => crumb.label)).toEqual([
      'Central',
      'Clients',
      'SWMW Law',
      'Podcast',
    ]);
    expect(context.subtitle).toBeTruthy();
    expect(context.actionsSlot).toBe('board');
  });
});
