import { describe, expect, it } from 'vitest';
import {
  getStatusBackgroundColor,
  normalizeStatusColor,
} from '@/lib/email/status-colors';

describe('email status colors', () => {
  it('preserves valid app status colors', () => {
    expect(normalizeStatusColor('#9d50dd')).toBe('#9d50dd');
  });

  it('falls back when status colors are missing or invalid', () => {
    expect(normalizeStatusColor(null)).toBe('#6B7280');
    expect(normalizeStatusColor('purple')).toBe('#6B7280');
  });

  it('creates an email-safe translucent background color', () => {
    expect(getStatusBackgroundColor('#9d50dd')).toBe('rgba(157, 80, 221, 0.12)');
  });
});
