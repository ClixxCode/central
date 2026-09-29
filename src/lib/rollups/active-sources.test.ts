import { describe, expect, it } from 'vitest'
import {
  filterActiveRollupSources,
  isHiddenRollupAccountStatus,
  isHiddenRollupPodSubContext,
} from './active-sources'

const source = (
  accountStatus: string | null,
  podSubContext: string | null,
  name = 'board',
) => ({ name, sourceBoard: { client: { accountStatus, podSubContext } } })

describe('isHiddenRollupPodSubContext', () => {
  it('hides the sub-contexts that buy no marketing', () => {
    expect(isHiddenRollupPodSubContext('maintenance')).toBe(true)
    expect(isHiddenRollupPodSubContext('hosting-only')).toBe(true)
  })

  it('shows every sub-context that has delivery work', () => {
    for (const s of ['nurture', 'growth', 'depth + growth']) {
      expect(isHiddenRollupPodSubContext(s)).toBe(false)
    }
  })

  // A null must SHOW. Two live Pod 1 accounts carry one, and one of them is an
  // onboarding client with a running website build.
  it('shows a null or empty sub-context', () => {
    expect(isHiddenRollupPodSubContext(null)).toBe(false)
    expect(isHiddenRollupPodSubContext(undefined)).toBe(false)
    expect(isHiddenRollupPodSubContext('')).toBe(false)
  })

  it('is insensitive to case and surrounding space', () => {
    expect(isHiddenRollupPodSubContext('  Maintenance ')).toBe(true)
    expect(isHiddenRollupPodSubContext('Hosting-Only')).toBe(true)
  })
})

describe('filterActiveRollupSources', () => {
  it('drops hosting/maintenance clients and keeps the marketing book', () => {
    const kept = filterActiveRollupSources([
      source('active', 'maintenance', 'dent-devil'),
      source('active', 'hosting-only', 'river-rock'),
      source('active', 'nurture', 'nurture-client'),
      source('active', 'growth', 'growth-client'),
    ])
    expect(kept.map((s) => s.name)).toEqual(['nurture-client', 'growth-client'])
  })

  // The two rules are independent: neither should mask the other.
  it('still drops a terminated client whose sub-context is shown', () => {
    const kept = filterActiveRollupSources([source('terminated', 'growth')])
    expect(kept).toHaveLength(0)
  })

  it('drops a maintenance client whose status is shown', () => {
    const kept = filterActiveRollupSources([source('active', 'maintenance')])
    expect(kept).toHaveLength(0)
  })

  it('keeps a client with neither field set', () => {
    expect(filterActiveRollupSources([source(null, null)])).toHaveLength(1)
  })

  // Lutheran Living: onboarding, null sub-context, live Clix Platform build.
  it('keeps an onboarding client with no sub-context', () => {
    const kept = filterActiveRollupSources([source('onboarding', null, 'lutheran')])
    expect(kept.map((s) => s.name)).toEqual(['lutheran'])
  })

  it('tolerates a missing board or client', () => {
    expect(filterActiveRollupSources([{ sourceBoard: null }])).toHaveLength(1)
    expect(
      filterActiveRollupSources([{ sourceBoard: { client: null } }]),
    ).toHaveLength(1)
  })
})

describe('isHiddenRollupAccountStatus', () => {
  it('is unchanged by this addition', () => {
    expect(isHiddenRollupAccountStatus('terminated')).toBe(true)
    expect(isHiddenRollupAccountStatus('active')).toBe(false)
    expect(isHiddenRollupAccountStatus(null)).toBe(false)
  })
})
