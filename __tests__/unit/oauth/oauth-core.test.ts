import { describe, expect, it, beforeAll } from 'vitest';
import { base64UrlSha256, signTransaction, verifyPkce, verifyTransaction } from '@/lib/oauth/crypto';
import { parseScopes } from '@/lib/oauth/http';
import { validateRedirectUri } from '@/lib/oauth/clients';
import { clientCredentialsFromRequest } from '@/lib/oauth/client-auth';
import { textToTiptap, tiptapToText } from '@/lib/mcp/text';

describe('OAuth core security helpers', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-with-enough-entropy';
  });

  it('verifies S256 PKCE and rejects the wrong verifier', () => {
    const verifier = 'a'.repeat(43);
    const challenge = base64UrlSha256(verifier);
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce('b'.repeat(43), challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
    expect(verifyPkce('å'.repeat(43), challenge)).toBe(false);
  });

  it('detects tampering in signed consent transactions', () => {
    const signed = signTransaction({ clientId: 'client', expiresAt: Date.now() + 1000 });
    expect(verifyTransaction<{ clientId: string }>(signed)?.clientId).toBe('client');
    expect(verifyTransaction(`${signed.slice(0, -1)}x`)).toBeNull();
  });

  it('normalizes write scope to include read and rejects unknown scopes', () => {
    expect(parseScopes('central:write')).toEqual(['central:read', 'central:write']);
    expect(parseScopes('central:read central:read')).toEqual(['central:read']);
    expect(parseScopes('')).toEqual(['central:read']);
    expect(() => parseScopes('central:admin')).toThrow(/Only central:read/);
  });

  it('allows HTTPS and loopback redirects but rejects unsafe HTTP redirects', () => {
    expect(validateRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(
      'https://claude.ai/api/mcp/auth_callback'
    );
    expect(validateRedirectUri('http://127.0.0.1:3456/callback')).toBe(
      'http://127.0.0.1:3456/callback'
    );
    expect(() => validateRedirectUri('http://example.com/callback')).toThrow(/HTTPS/);
    expect(() => validateRedirectUri('https://user:pass@example.com/callback')).toThrow(/credentials/);
  });

  it('distinguishes public, basic-auth, and form-secret clients', () => {
    const publicForm = new FormData();
    publicForm.set('client_id', 'public-client');
    expect(clientCredentialsFromRequest(new Request('https://central.test/oauth/token'), publicForm)).toEqual({
      clientId: 'public-client',
      clientSecret: undefined,
      method: 'none',
    });

    const postForm = new FormData();
    postForm.set('client_id', 'post-client');
    postForm.set('client_secret', 'post-secret');
    expect(clientCredentialsFromRequest(new Request('https://central.test/oauth/token'), postForm)).toEqual({
      clientId: 'post-client',
      clientSecret: 'post-secret',
      method: 'client_secret_post',
    });

    const basic = Buffer.from('basic-client:basic-secret').toString('base64');
    expect(
      clientCredentialsFromRequest(
        new Request('https://central.test/oauth/token', {
          headers: { Authorization: `Basic ${basic}` },
        }),
        new FormData()
      )
    ).toEqual({
      clientId: 'basic-client',
      clientSecret: 'basic-secret',
      method: 'client_secret_basic',
    });
  });
});

describe('MCP text conversion', () => {
  it('round-trips paragraphs, line breaks, and links to readable text', () => {
    const source = 'First line\nsecond line\n\nVisit https://central.example.com/tasks/123';
    const document = textToTiptap(source);
    expect(tiptapToText(document)).toBe(source);
    const linkedText = document.content?.[1]?.content?.find((node) => node.text?.startsWith('https://'));
    expect(linkedText?.marks?.[0]?.type).toBe('link');
  });
});
