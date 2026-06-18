import { describe, expect, it } from 'vitest';
import {
  normalizeEmailBaseUrl,
  resolveEmailFromConfig,
} from '@/lib/email/client';

describe('email client URL helpers', () => {
  it('normalizes bare email domains to https URLs', () => {
    expect(normalizeEmailBaseUrl('central.clix.co')).toBe('https://central.clix.co');
  });

  it('preserves explicit protocols and removes trailing slashes', () => {
    expect(normalizeEmailBaseUrl('https://central.clix.co/')).toBe('https://central.clix.co');
    expect(normalizeEmailBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  });
});

describe('email from config', () => {
  it('uses EMAIL_FROM exactly when provided', () => {
    expect(
      resolveEmailFromConfig({
        EMAIL_DOMAIN: 'central.clix.co',
        EMAIL_FROM: 'Central <hello@central.clix.co>',
      })
    ).toEqual({
      from: 'Central <hello@central.clix.co>',
      replyTo: 'hello@central.clix.co',
    });
  });

  it('falls back to EMAIL_DOMAIN for the default sender address', () => {
    expect(resolveEmailFromConfig({ EMAIL_DOMAIN: 'central.clix.co' })).toEqual({
      from: 'Central <noreply@central.clix.co>',
      replyTo: 'noreply@central.clix.co',
    });
  });

  it('still supports split legacy sender vars', () => {
    expect(
      resolveEmailFromConfig({
        EMAIL_FROM_NAME: 'Central Ops',
        EMAIL_FROM_ADDRESS: 'ops@central.clix.co',
        EMAIL_REPLY_TO: 'support@central.clix.co',
      })
    ).toEqual({
      from: 'Central Ops <ops@central.clix.co>',
      replyTo: 'support@central.clix.co',
    });
  });
});
