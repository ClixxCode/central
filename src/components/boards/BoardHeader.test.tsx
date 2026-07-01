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
  it('keeps parent project context out of the top shell header', () => {
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
      'Matter Projects',
      'Podcast',
    ]);
    expect(context.breadcrumbs[3]).toMatchObject({
      label: 'Matter Projects',
      href: '/clients/swmw-law/boards/parent-board',
    });
    expect(context.subtitle).toBeUndefined();
    expect(context.titleIcon).toBeUndefined();
    expect(context.tabs).toBeUndefined();
    expect(context.actionsSlot).toBe('board');
  });

  it('omits the parent board breadcrumb when the parent board matches the client name', () => {
    render(
      <BoardHeader
        boardId="project-1"
        boardName="Podcast"
        clientName="SWMW Law"
        clientSlug="swmw-law"
        canEdit
        parentBoard={{
          id: 'default-board',
          name: 'SWMW Law',
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
  });

  it('omits the current board breadcrumb when the board matches the client name', () => {
    render(
      <BoardHeader
        boardId="board-1"
        boardName="Rent One"
        clientName="Rent One"
        clientSlug="rent-one"
        canEdit
      />
    );

    const calls = mocks.useTopShellContextOverride.mock.calls;
    const context = calls[calls.length - 1]?.[0] as TopShellContext;

    expect(context.breadcrumbs.map((crumb) => crumb.label)).toEqual([
      'Central',
      'Clients',
      'Rent One',
    ]);
  });
});
