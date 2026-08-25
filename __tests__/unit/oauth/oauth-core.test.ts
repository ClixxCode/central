import { describe, expect, it, beforeAll, vi } from 'vitest';
import { base64UrlSha256, signTransaction, verifyPkce, verifyTransaction } from '@/lib/oauth/crypto';
import { oauthErrorResponse, parseScopes } from '@/lib/oauth/http';
import { parseOAuthClientMetadata, validateRedirectUri } from '@/lib/oauth/clients';
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

  it('allows HTTPS, loopback, and native app redirects while rejecting unsafe redirects', () => {
    expect(validateRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(
      'https://claude.ai/api/mcp/auth_callback'
    );
    expect(validateRedirectUri('http://127.0.0.1:3456/callback')).toBe(
      'http://127.0.0.1:3456/callback'
    );
    expect(validateRedirectUri('com.raycast:/oauth', 'native')).toBe('com.raycast:/oauth');
    expect(validateRedirectUri('raycast://mcp-oauth-callback', 'native')).toBe(
      'raycast://mcp-oauth-callback'
    );
    expect(() => validateRedirectUri('com.raycast:/oauth')).toThrow(/native client/);
    expect(() => validateRedirectUri('http://example.com/callback')).toThrow(/HTTPS/);
    expect(() => validateRedirectUri('javascript:alert(1)', 'native')).toThrow(/private-use/);
    expect(() => validateRedirectUri('https://user:pass@example.com/callback')).toThrow(/credentials/);
  });

  it('infers Raycast client metadata as native when application_type is omitted', () => {
    const clientId = 'https://www.raycast.com/.well-known/oauth-client-metadata/raycast.json';
    const client = parseOAuthClientMetadata(clientId, {
      client_id: clientId,
      client_name: 'Raycast',
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: [
        'com.raycast.development:/oauth',
        'com.raycast:/oauth',
        'raycast://mcp-oauth-callback',
        'http://127.0.0.1/callback',
      ],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });

    expect(client.applicationType).toBe('native');
    expect(client.redirectUris).toContain('com.raycast:/oauth');
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

  it('logs unexpected OAuth failures while returning a generic server error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = oauthErrorResponse(new Error('database connection failed'));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'server_error',
        error_description: 'The authorization server could not complete the request',
      });
      expect(consoleError).toHaveBeenCalledOnce();
      expect(JSON.parse(String(consoleError.mock.calls[0]?.[0]))).toMatchObject({
        level: 'error',
        message: 'Unexpected OAuth request failure',
        errorName: 'Error',
        errorMessage: 'database connection failed',
      });
    } finally {
      consoleError.mockRestore();
    }
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
