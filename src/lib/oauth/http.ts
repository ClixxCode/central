import type { OAuthScope } from '@/lib/db/schema';
import { OAUTH_SCOPES, oauthIssuer } from './config';

export class OAuthRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function oauthErrorResponse(error: unknown): Response {
  const normalized =
    error instanceof OAuthRequestError
      ? error
      : new OAuthRequestError('server_error', 'The authorization server could not complete the request', 500);
  return Response.json(
    { error: normalized.code, error_description: normalized.message },
    {
      status: normalized.status,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export function parseScopes(raw: string | null | undefined): OAuthScope[] {
  const requested = [
    ...new Set((raw?.trim() || 'central:read').split(/\s+/).filter(Boolean)),
  ];
  if (requested.some((scope) => !OAUTH_SCOPES.includes(scope as OAuthScope))) {
    throw new OAuthRequestError('invalid_scope', 'Only central:read and central:write are supported');
  }
  const scopes = requested as OAuthScope[];
  if (scopes.includes('central:write') && !scopes.includes('central:read')) {
    scopes.unshift('central:read');
  }
  return scopes;
}

export function appendOAuthResult(
  redirectUri: string,
  values: Record<string, string | undefined>
): URL {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url;
}

export function noStoreJson(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Access-Control-Allow-Origin', '*');
  return Response.json(data, { ...init, headers });
}

export function assertCanonicalRequestHost(request: Request): void {
  if (new URL(request.url).origin !== oauthIssuer()) {
    throw new OAuthRequestError('invalid_request', 'OAuth request host does not match the configured issuer');
  }
}
