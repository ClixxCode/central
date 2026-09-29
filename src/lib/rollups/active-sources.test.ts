import { describe, expect, it } from 'vitest'
import {
  filterActiveRollupSources,
  isHiddenRollupAccountStatus,
  isHiddenRollupDeliveryState,
} from './active-sources'

const source = (
  accountStatus: string | null,
  hasDeliveryWork: boolean | null = true,
  name = 'board',
) => ({ name, sourceBoard: { client: { accountStatus, hasDeliveryWork } } })

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
      source('terminated', true, 'gone'),
      source('active', true, 'live'),
      source('onboarding', true, 'starting'),
      source(null, true, 'unsynced'),
    ])
    expect(kept.map((s) => s.name)).toEqual(['live', 'starting', 'unsynced'])
  })

  // The Dent Devil: $500/mo of WordPress hosting and maintenance, no
  // marketing. This is the case the whole change exists for.
  it('drops a client with no paid delivery work', () => {
    expect(filterActiveRollupSources([source('active', false)])).toHaveLength(0)
  })

  // Law Offices of Patrick O'Brien: tagged 'maintenance' in Pulse and paying
  // $1,500/mo for Digital Marketing. The tag is about how the account is
  // MANAGED; only billing says whether there is work.
  it('keeps a marketing client regardless of how it is tagged', () => {
    const kept = filterActiveRollupSources([source('active', true, 'obrien')])
    expect(kept.map((s) => s.name)).toEqual(['obrien'])
  })

  // The two rules are independent: neither may mask the other.
  it('drops a terminated client that still has delivery work', () => {
    expect(filterActiveRollupSources([source('terminated', true)])).toHaveLength(0)
  })

  it('shows a client whose flag has not synced yet', () => {
    expect(filterActiveRollupSources([source('active', null)])).toHaveLength(1)
  })

  it('tolerates a missing board or client', () => {
    expect(filterActiveRollupSources([{ sourceBoard: null }])).toHaveLength(1)
    expect(
      filterActiveRollupSources([{ sourceBoard: { client: null } }]),
    ).toHaveLength(1)
  })
})

describe('isHiddenRollupDeliveryState', () => {
  it('hides only an explicit false', () => {
    expect(isHiddenRollupDeliveryState(false)).toBe(true)
  })

  // Not falsy — an unsynced or pre-column row must show. Hiding a live board
  // is the expensive mistake; showing a stale one is not.
  it('shows true, null and undefined', () => {
    expect(isHiddenRollupDeliveryState(true)).toBe(false)
    expect(isHiddenRollupDeliveryState(null)).toBe(false)
    expect(isHiddenRollupDeliveryState(undefined)).toBe(false)
  })
})
