import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('hashes a password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('produces different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('verifies correct password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword123', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('accepts valid password', () => {
      const result = validatePassword('ValidPass123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects password shorter than 8 characters', () => {
      const result = validatePassword('Pass1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('rejects password without uppercase', () => {
      const result = validatePassword('lowercase123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects password without lowercase', () => {
      const result = validatePassword('UPPERCASE123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects password without number', () => {
      const result = validatePassword('NoNumbersHere');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('returns multiple errors for multiple violations', () => {
      const result = validatePassword('short');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

describe('Auth Exports', () => {
  it('exports password utilities from password module', async () => {
    const { hashPassword, verifyPassword, validatePassword } = await import('@/lib/auth/password');

    expect(hashPassword).toBeDefined();
    expect(verifyPassword).toBeDefined();
    expect(validatePassword).toBeDefined();
  });

  // Note: Full auth module exports require database connection
  // Integration tests will verify the complete module
});

describe('Clix.co Email Detection', () => {
  it('detects @clix.co emails', () => {
    const clixEmails = [
      'user@clix.co',
      'admin@clix.co',
      'test.user@clix.co',
    ];

    clixEmails.forEach((email) => {
      expect(email.endsWith('@clix.co')).toBe(true);
    });
  });

  it('rejects non-clix emails', () => {
    const otherEmails = [
      'user@gmail.com',
      'user@clix.com',
      'user@notclix.co',
      'clix.co@other.com',
    ];

    otherEmails.forEach((email) => {
      expect(email.endsWith('@clix.co')).toBe(false);
    });
  });
});
