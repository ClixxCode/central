import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RollupHeader } from './RollupHeader';
import type { TopShellContext } from '@/components/layout/shell-context';

const mocks = vi.hoisted(() => ({
  useTopShellContextOverride: vi.fn(),
}));

vi.mock('@/components/layout/top-shell-override', () => ({
  useTopShellContextOverride: mocks.useTopShellContextOverride,
}));

vi.mock('@/components/shared/FavoriteButton', () => ({
  FavoriteButton: () => <button type="button">Favorite rollup</button>,
}));

vi.mock('./RollupReviewButton', () => ({
  RollupReviewButton: () => <button type="button">Review rollup</button>,
}));

describe('RollupHeader', () => {
  it('uses the loaded rollup name for the top shell context', () => {
    render(
      <RollupHeader
        rollupId="1dd506cd"
        rollupName="Pod 2"
        reviewModeEnabled
      />
    );

    const calls = mocks.useTopShellContextOverride.mock.calls;
    const context = calls[calls.length - 1]?.[0] as TopShellContext;

    expect(context.title).toBe('Pod 2');
    expect(context.breadcrumbs.map((crumb) => crumb.label)).toEqual([
      'Central',
      'Rollups',
      'Pod 2',
    ]);
    expect(context.actionsSlot).toBe('board');
  });
});
