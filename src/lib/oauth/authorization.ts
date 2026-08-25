import crypto from 'crypto';
import type { OAuthScope } from '@/lib/db/schema';
import { validateRedirectUri, type ResolvedOAuthClient } from './clients';
import { mcpResourceUrl, oauthIssuer } from './config';
import { parseScopes, OAuthRequestError } from './http';

export const OAUTH_TRANSACTION_COOKIE = 'central-oauth-transaction';

export interface AuthorizationTransaction {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  redirectUri: string;
  scopes: OAuthScope[];
  resource: string;
  state?: string;
  codeChallenge: string;
  csrf: string;
  expiresAt: number;
}

export function parseAuthorizationRequest(
  searchParams: URLSearchParams,
  client: ResolvedOAuthClient
): Omit<AuthorizationTransaction, 'clientName' | 'clientUri' | 'csrf' | 'expiresAt'> {
  if (searchParams.get('response_type') !== 'code') {
    throw new OAuthRequestError('unsupported_response_type', 'Only response_type=code is supported');
  }
  const responseMode = searchParams.get('response_mode');
  if (responseMode && responseMode !== 'query') {
    throw new OAuthRequestError('invalid_request', 'Only response_mode=query is supported');
  }
  const redirectUri = searchParams.get('redirect_uri');
  if (!redirectUri || !client.redirectUris.includes(validateRedirectUri(redirectUri))) {
    throw new OAuthRequestError('invalid_request', 'redirect_uri is not registered for this client');
  }
  const codeChallenge = searchParams.get('code_challenge');
  if (
    !codeChallenge ||
    searchParams.get('code_challenge_method') !== 'S256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)
  ) {
    throw new OAuthRequestError('invalid_request', 'PKCE with code_challenge_method=S256 is required');
  }
  const resource = searchParams.get('resource');
  if (resource !== mcpResourceUrl()) {
    throw new OAuthRequestError('invalid_target', `resource must be ${mcpResourceUrl()}`);
  }
  const clientId = searchParams.get('client_id');
  if (clientId !== client.clientId) {
    throw new OAuthRequestError('invalid_client', 'client_id mismatch');
  }
  const state = searchParams.get('state');
  if (state && state.length > 2048) {
    throw new OAuthRequestError('invalid_request', 'state must be at most 2048 characters');
  }
  return {
    clientId,
    redirectUri: validateRedirectUri(redirectUri),
    scopes: parseScopes(searchParams.get('scope')),
    resource,
    state: state ?? undefined,
    codeChallenge,
  };
}

export function createAuthorizationTransaction(
  request: Omit<AuthorizationTransaction, 'clientName' | 'clientUri' | 'csrf' | 'expiresAt'>,
  client: ResolvedOAuthClient
): AuthorizationTransaction {
  return {
    ...request,
    clientName: client.clientName,
    clientUri: client.clientUri,
    csrf: crypto.randomBytes(24).toString('base64url'),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
}

export function authorizationRedirect(
  transaction: AuthorizationTransaction,
  values: Record<string, string | undefined>
): URL {
  const url = new URL(transaction.redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  url.searchParams.set('iss', oauthIssuer());
  if (transaction.state) url.searchParams.set('state', transaction.state);
  return url;
}
