import { describe, it, expect } from 'vitest';
import {
  BUILD_ARCHIVE_REASONS,
  NOISE_ARCHIVE_REASON_IDS,
  getBuildArchiveReason,
  isValidBuildArchiveReason,
} from '@/lib/builds/archive-reasons';

describe('build archive reasons', () => {
  it('has unique, persisted ids', () => {
    const ids = BUILD_ARCHIVE_REASONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every id within the varchar(32) column', () => {
    for (const r of BUILD_ARCHIVE_REASONS) {
      expect(r.id.length).toBeLessThanOrEqual(32);
    }
  });

  it('validates known ids and rejects anything else', () => {
    expect(isValidBuildArchiveReason('client_cancelled')).toBe(true);
    expect(isValidBuildArchiveReason('nope')).toBe(false);
    expect(isValidBuildArchiveReason(null)).toBe(false);
    expect(isValidBuildArchiveReason('')).toBe(false);
  });

  it('resolves a reason to its metadata', () => {
    expect(getBuildArchiveReason('duplicate')?.label).toBe('Duplicate card');
    expect(getBuildArchiveReason('nope')).toBeUndefined();
  });

  it('separates bookkeeping noise from real abandoned effort', () => {
    // Pulse filters on this: a cancelled build is a duration datapoint, a
    // duplicate card is not.
    expect(NOISE_ARCHIVE_REASON_IDS).toEqual(['duplicate', 'created_in_error']);
    expect(getBuildArchiveReason('client_cancelled')?.excludeFromAnalytics).toBe(false);
  });
});
