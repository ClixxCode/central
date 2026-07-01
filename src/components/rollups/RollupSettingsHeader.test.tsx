import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RollupSettingsHeader } from './RollupSettingsHeader';
import type { TopShellContext } from '@/components/layout/shell-context';

const mocks = vi.hoisted(() => ({
  useTopShellContextOverride: vi.fn(),
}));

vi.mock('@/components/layout/top-shell-override', () => ({
  useTopShellContextOverride: mocks.useTopShellContextOverride,
}));

describe('RollupSettingsHeader', () => {
  it('uses the loaded rollup name instead of the route id fallback', () => {
    render(<RollupSettingsHeader rollupId="1dd506cd" rollupName="Pod 2" />);

    const calls = mocks.useTopShellContextOverride.mock.calls;
    const context = calls[calls.length - 1]?.[0] as TopShellContext;

    expect(context.title).toBe('Settings');
    expect(context.subtitle).toBe('Pod 2');
    expect(context.breadcrumbs.map((crumb) => crumb.label)).toEqual([
      'Central',
      'Rollups',
      'Pod 2',
      'Settings',
    ]);
    expect(context.rollup).toMatchObject({
      id: '1dd506cd',
      name: 'Pod 2',
      href: '/rollups/1dd506cd',
    });
  });
});
