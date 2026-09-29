import { describe, expect, it } from 'vitest'
import {
  filterActiveRollupSources,
  isHiddenRollupAccountStatus,
} from './active-sources'

const source = (accountStatus: string | null, name = 'board') => ({
  name,
  sourceBoard: { client: { accountStatus } },
})

describe('isHiddenRollupAccountStatus', () => {
  it('hides terminated clients', () => {
    expect(isHiddenRollupAccountStatus('terminated')).toBe(true)
    expect(isHiddenRollupAccountStatus('  Terminated ')).toBe(true)
  })

  // Deny-list: seven Central clients have a null status because they were
  // never synced from Pulse, and an allow-list would hide all of them.
  it('shows everything else, including null', () => {
    for (const s of ['active', 'paused', 'onboarding', 'offboarding']) {
      expect(isHiddenRollupAccountStatus(s)).toBe(false)
    }
    expect(isHiddenRollupAccountStatus(null)).toBe(false)
    expect(isHiddenRollupAccountStatus(undefined)).toBe(false)
    expect(isHiddenRollupAccountStatus('')).toBe(false)
  })
})

describe('filterActiveRollupSources', () => {
  it('drops terminated sources and keeps the rest', () => {
    const kept = filterActiveRollupSources([
      source('terminated', 'gone'),
      source('active', 'live'),
      source('onboarding', 'starting'),
      source(null, 'unsynced'),
    ])
    expect(kept.map((s) => s.name)).toEqual(['live', 'starting', 'unsynced'])
  })

  it('tolerates a missing board or client', () => {
    expect(filterActiveRollupSources([{ sourceBoard: null }])).toHaveLength(1)
    expect(
      filterActiveRollupSources([{ sourceBoard: { client: null } }]),
    ).toHaveLength(1)
  })
})
