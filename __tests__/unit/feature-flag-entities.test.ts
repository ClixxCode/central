import { describe, expect, it } from 'vitest';
import { getCentralFlagEntities } from '@/lib/feature-flags/entities';

describe('Central flag entities', () => {
  it('returns no user entity when there is no authenticated user', () => {
    expect(getCentralFlagEntities(null)).toEqual({});
  });

  it('builds a user entity for Vercel Flags targeting', () => {
    expect(
      getCentralFlagEntities({
        id: 'user-123',
        email: ' Beta.User@Example.COM ',
        name: 'Beta User',
        role: 'user',
      })
    ).toEqual({
      user: {
        id: 'user-123',
        email: 'beta.user@example.com',
        emailDomain: 'example.com',
        name: 'Beta User',
        role: 'user',
        isAdmin: false,
      },
    });
  });

  it('exposes admin status without requiring dashboard rules to infer it from role', () => {
    expect(
      getCentralFlagEntities({
        id: 'admin-123',
        email: 'admin@example.com',
        name: null,
        role: 'admin',
      })
    ).toEqual({
      user: {
        id: 'admin-123',
        email: 'admin@example.com',
        emailDomain: 'example.com',
        role: 'admin',
        isAdmin: true,
      },
    });
  });
});
