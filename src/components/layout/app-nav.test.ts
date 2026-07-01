import { describe, expect, it } from 'vitest';
import {
  getAppNavActiveItem,
  getOrderedAppNavItems,
  getVisibleAppNavItems,
  normalizeAppNavPreferenceLabels,
} from './app-nav';

describe('app-nav preference helpers', () => {
  it('normalizes legacy and stale preference labels', () => {
    expect(
      normalizeAppNavPreferenceLabels([
        'ClientList',
        'Clients',
        'Unknown',
        'Templates',
      ])
    ).toEqual(['Clients', 'Templates']);
  });

  it('preserves user nav order while deduping and filling missing items', () => {
    const items = getOrderedAppNavItems({
      navOrder: ['Templates', 'ClientList', 'Templates', 'Unknown'],
      showScheduleInSidebar: true,
      surface: 'mobile',
    });

    expect(items.map((item) => item.preferenceLabel)).toEqual([
      'Templates',
      'Clients',
      'My Work',
      'Rollups',
      'Schedule',
    ]);
    expect(items.find((item) => item.preferenceLabel === 'My Work')?.label).toBe('My Tasks');
  });

  it('keeps legacy hidden client preferences effective for desktop and mobile nav', () => {
    const mobileItems = getVisibleAppNavItems({
      hiddenNavItems: ['ClientList', 'Templates'],
      showScheduleInSidebar: true,
      surface: 'mobile',
    });
    const desktopItems = getVisibleAppNavItems({
      hiddenNavItems: ['ClientList'],
      showScheduleInSidebar: true,
      surface: 'desktop',
    });

    expect(mobileItems.map((item) => item.preferenceLabel)).toEqual([
      'My Work',
      'Rollups',
      'Schedule',
    ]);
    expect(desktopItems.map((item) => item.preferenceLabel)).toEqual([
      'My Work',
      'Rollups',
      'Schedule',
      'Templates',
    ]);
  });

  it('does not allow always-visible app nav items to be hidden', () => {
    const items = getVisibleAppNavItems({
      hiddenNavItems: ['My Work', 'Schedule'],
      showScheduleInSidebar: true,
    });

    expect(items.map((item) => item.preferenceLabel)).toContain('My Work');
    expect(items.map((item) => item.preferenceLabel)).toContain('Schedule');
  });

  it('maps app nav preference labels to shell active item ids', () => {
    expect(getAppNavActiveItem('My Work')).toBe('my-work');
    expect(getAppNavActiveItem('Clients')).toBe('clients');
    expect(getAppNavActiveItem('Rollups')).toBe('rollups');
    expect(getAppNavActiveItem('Schedule')).toBe('schedule');
    expect(getAppNavActiveItem('Templates')).toBe('templates');
  });
});
