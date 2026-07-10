import 'server-only';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError } from './oauth-service';

export const MCP_RESOURCE_PATH = '/api/mcp';
export const MCP_SCOPES = ['tasks:read', 'tasks:write'] as const;

export type McpAuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  state?: string;
};

export function publicBaseUrl(request: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const url = new URL(configuredUrl);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function mcpResourceUrl(request: NextRequest): string {
  return `${publicBaseUrl(request)}${MCP_RESOURCE_PATH}`;
}

export function authorizationServerMetadata(request: NextRequest) {
  const issuer = publicBaseUrl(request);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: MCP_SCOPES,
    protected_resources: [mcpResourceUrl(request)],
  };
}

export function protectedResourceMetadata(request: NextRequest) {
  return {
    resource: mcpResourceUrl(request),
    authorization_servers: [publicBaseUrl(request)],
    bearer_methods_supported: ['header'],
    scopes_supported: MCP_SCOPES,
  };
}

export function oauthErrorResponse(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function oauthServiceErrorResponse(error: unknown) {
  if (error instanceof McpOAuthError) {
    return oauthErrorResponse(error.code, error.message, error.code === 'invalid_client' ? 401 : 400);
  }
  return oauthErrorResponse('server_error', 'Unable to complete the OAuth request', 500);
}

export function parseAuthorizationRequest(params: URLSearchParams): McpAuthorizationRequest | McpOAuthError {
  if (params.get('response_type') !== 'code') {
    return new McpOAuthError('invalid_grant', 'Only the authorization code response type is supported');
  }
  if (params.get('code_challenge_method') !== 'S256') {
    return new McpOAuthError('invalid_grant', 'PKCE S256 is required');
  }

  const clientId = params.get('client_id')?.trim();
  const redirectUri = params.get('redirect_uri')?.trim();
  const codeChallenge = params.get('code_challenge')?.trim();
  const scopes = (params.get('scope') ?? '').split(' ').map((scope) => scope.trim()).filter(Boolean);
  const state = params.get('state') ?? undefined;
  if (!clientId || !redirectUri || !codeChallenge || scopes.length === 0) {
    return new McpOAuthError('invalid_grant', 'client_id, redirect_uri, scope, and code_challenge are required');
  }
  return { clientId, redirectUri, scopes, codeChallenge, state };
}

function oauthSigningSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for OAuth consent');
  return secret;
}

export function signAuthorizationRequest(value: McpAuthorizationRequest): string {
  const payload = Buffer.from(JSON.stringify({ ...value, issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', oauthSigningSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAuthorizationRequest(value: string): McpAuthorizationRequest | null {
  const [payload, signature, ...extra] = value.split('.');
  if (!payload || !signature || extra.length > 0) return null;

  const expected = crypto.createHmac('sha256', oauthSigningSecret()).update(payload).digest('base64url');
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (
      typeof parsed?.clientId !== 'string' ||
      typeof parsed?.redirectUri !== 'string' ||
      !Array.isArray(parsed?.scopes) ||
      typeof parsed?.codeChallenge !== 'string' ||
      (parsed.state !== undefined && typeof parsed.state !== 'string') ||
      typeof parsed.issuedAt !== 'number' ||
      !Number.isFinite(parsed.issuedAt) ||
      parsed.issuedAt < Date.now() - 10 * 60 * 1000 ||
      parsed.issuedAt > Date.now() + 60 * 1000
    ) return null;
    return {
      clientId: parsed.clientId,
      redirectUri: parsed.redirectUri,
      scopes: parsed.scopes,
      codeChallenge: parsed.codeChallenge,
      state: parsed.state,
    };
  } catch {
    return null;
  }
}

export function redirectWithOAuthParameters(redirectUri: string, parameters: Record<string, string | undefined>) {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) target.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(target);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}
