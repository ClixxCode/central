import dns from 'dns/promises';
import net from 'net';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  oauthClientMetadataCache,
  oauthClients,
  type OAuthTokenEndpointAuthMethod,
} from '@/lib/db/schema';
import { hashClientSecret, randomOpaqueToken, verifyClientSecret } from './crypto';
import { OAuthRequestError } from './http';

const CIMD_MAX_BYTES = 64 * 1024;
const CIMD_CACHE_MS = 10 * 60 * 1000;
const UNSAFE_NATIVE_REDIRECT_PROTOCOLS = new Set([
  'about:',
  'blob:',
  'data:',
  'file:',
  'ftp:',
  'javascript:',
  'mailto:',
  'tel:',
  'urn:',
  'ws:',
  'wss:',
]);

export interface ResolvedOAuthClient {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  logoUri: string | null;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod;
  applicationType: string;
  source: 'registered' | 'metadata';
  clientSecretHash: string | null;
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIp(normalized.slice('::ffff:'.length));
    }
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('ff')
    );
  }
  return true;
}

async function assertPublicHttpsUrl(raw: string, field: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OAuthRequestError('invalid_client_metadata', `${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new OAuthRequestError(
      'invalid_client_metadata',
      `${field} must be an HTTPS URL without credentials or a fragment`
    );
  }
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new OAuthRequestError('invalid_client_metadata', `${field} resolves to a non-public address`);
  }
  return url;
}

export function validateRedirectUri(raw: string, applicationType = 'web'): string {
  if (raw.length > 2048) {
    throw new OAuthRequestError('invalid_redirect_uri', 'redirect_uri must be at most 2048 characters');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OAuthRequestError('invalid_redirect_uri', 'redirect_uri must be a valid URL');
  }
  const loopback =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  const privateUseScheme =
    applicationType === 'native' &&
    url.protocol !== 'http:' &&
    url.protocol !== 'https:' &&
    !UNSAFE_NATIVE_REDIRECT_PROTOCOLS.has(url.protocol);
  if (url.username || url.password || url.hash) {
    throw new OAuthRequestError(
      'invalid_redirect_uri',
      'redirect_uri must not contain credentials or a fragment'
    );
  }
  if (url.protocol !== 'https:' && !loopback && !privateUseScheme) {
    throw new OAuthRequestError(
      'invalid_redirect_uri',
      'redirect_uri must use HTTPS, an HTTP localhost loopback address, or a private-use URI scheme for a native client'
    );
  }
  return url.toString();
}

export function parseOAuthClientMetadata(
  clientId: string,
  value: Record<string, unknown>
): ResolvedOAuthClient {
  if (value.client_id !== clientId) {
    throw new OAuthRequestError('invalid_client_metadata', 'Metadata client_id must exactly match its URL');
  }
  if (typeof value.client_name !== 'string' || !value.client_name.trim()) {
    throw new OAuthRequestError('invalid_client_metadata', 'client_name is required');
  }
  if (!Array.isArray(value.redirect_uris) || value.redirect_uris.length === 0) {
    throw new OAuthRequestError('invalid_client_metadata', 'redirect_uris must be a non-empty array');
  }
  const applicationType =
    typeof value.application_type === 'string'
      ? value.application_type
      : value.redirect_uris.some((uri) => {
          if (typeof uri !== 'string') return false;
          try {
            const protocol = new URL(uri).protocol;
            return protocol !== 'http:' && protocol !== 'https:';
          } catch {
            return false;
          }
        })
        ? 'native'
        : 'web';
  if (!['web', 'native'].includes(applicationType)) {
    throw new OAuthRequestError('invalid_client_metadata', 'application_type must be web or native');
  }
  const redirectUris = value.redirect_uris.map((uri) => {
    if (typeof uri !== 'string') {
      throw new OAuthRequestError('invalid_client_metadata', 'redirect_uris must contain strings');
    }
    return validateRedirectUri(uri, applicationType);
  });
  const declaredGrantTypes = Array.isArray(value.grant_types)
    ? value.grant_types.filter((item): item is string => typeof item === 'string')
    : ['authorization_code', 'refresh_token'];
  const grantTypes = declaredGrantTypes.filter((grantType) =>
    ['authorization_code', 'refresh_token'].includes(grantType)
  );
  if (!grantTypes.includes('authorization_code')) {
    throw new OAuthRequestError(
      'invalid_client_metadata',
      'Client metadata must support the authorization_code grant'
    );
  }
  const responseTypes = Array.isArray(value.response_types)
    ? value.response_types.filter((item): item is string => typeof item === 'string')
    : ['code'];
  if (responseTypes.length !== 1 || responseTypes[0] !== 'code') {
    throw new OAuthRequestError('invalid_client_metadata', 'Client metadata must use response_type code');
  }
  return {
    clientId,
    clientName: value.client_name.slice(0, 255),
    clientUri: typeof value.client_uri === 'string' ? value.client_uri : null,
    logoUri: typeof value.logo_uri === 'string' ? value.logo_uri : null,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: 'none',
    applicationType,
    source: 'metadata',
    clientSecretHash: null,
  };
}

async function fetchClientMetadata(clientId: string): Promise<ResolvedOAuthClient> {
  const cached = await db.query.oauthClientMetadataCache.findFirst({
    where: and(
      eq(oauthClientMetadataCache.clientId, clientId),
      gt(oauthClientMetadataCache.expiresAt, new Date())
    ),
  });
  if (cached) return parseOAuthClientMetadata(clientId, cached.document);

  const url = await assertPublicHttpsUrl(clientId, 'client_id');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new OAuthRequestError('invalid_client', 'Unable to retrieve the client metadata document');
    }
    if (response.headers.get('content-length') && Number(response.headers.get('content-length')) > CIMD_MAX_BYTES) {
      throw new OAuthRequestError('invalid_client_metadata', 'Client metadata document is too large');
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > CIMD_MAX_BYTES) {
      throw new OAuthRequestError('invalid_client_metadata', 'Client metadata document is too large');
    }
    let document: Record<string, unknown>;
    try {
      document = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new OAuthRequestError('invalid_client_metadata', 'Client metadata document is not valid JSON');
    }
    const client = parseOAuthClientMetadata(clientId, document);
    await db
      .insert(oauthClientMetadataCache)
      .values({ clientId, document, expiresAt: new Date(Date.now() + CIMD_CACHE_MS) })
      .onConflictDoUpdate({
        target: oauthClientMetadataCache.clientId,
        set: { document, expiresAt: new Date(Date.now() + CIMD_CACHE_MS), updatedAt: new Date() },
      });
    return client;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveOAuthClient(clientId: string): Promise<ResolvedOAuthClient> {
  const registered = await db.query.oauthClients.findFirst({
    where: and(eq(oauthClients.clientId, clientId), eq(oauthClients.active, true)),
  });
  if (registered) {
    return {
      clientId: registered.clientId,
      clientName: registered.clientName,
      clientUri: registered.clientUri,
      logoUri: registered.logoUri,
      redirectUris: registered.redirectUris,
      grantTypes: registered.grantTypes,
      responseTypes: registered.responseTypes,
      tokenEndpointAuthMethod: registered.tokenEndpointAuthMethod,
      applicationType: registered.applicationType,
      source: 'registered',
      clientSecretHash: registered.clientSecretHash,
    };
  }
  if (clientId.startsWith('https://') && new URL(clientId).pathname !== '/') {
    return fetchClientMetadata(clientId);
  }
  throw new OAuthRequestError('invalid_client', 'Unknown OAuth client', 401);
}

export async function authenticateOAuthClient(input: {
  clientId: string;
  clientSecret?: string;
  method: OAuthTokenEndpointAuthMethod;
}): Promise<ResolvedOAuthClient> {
  const client = await resolveOAuthClient(input.clientId);
  if (input.method !== client.tokenEndpointAuthMethod) {
    throw new OAuthRequestError(
      'invalid_client',
      `Client must authenticate with ${client.tokenEndpointAuthMethod}`,
      401
    );
  }
  if (client.tokenEndpointAuthMethod === 'none') {
    if (client.source === 'registered') {
      void db.update(oauthClients).set({ lastUsedAt: new Date() }).where(eq(oauthClients.clientId, client.clientId)).catch(() => {});
    }
    return client;
  }
  if (!input.clientSecret || !client.clientSecretHash) {
    throw new OAuthRequestError('invalid_client', 'Client authentication is required', 401);
  }
  if (!(await verifyClientSecret(input.clientSecret, client.clientSecretHash))) {
    throw new OAuthRequestError('invalid_client', 'Client authentication failed', 401);
  }
  void db.update(oauthClients).set({ lastUsedAt: new Date() }).where(eq(oauthClients.clientId, client.clientId)).catch(() => {});
  return client;
}

export interface RegisterOAuthClientInput {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: OAuthTokenEndpointAuthMethod;
  applicationType?: string;
  clientUri?: string;
  logoUri?: string;
  registrationType: 'static' | 'dynamic';
  createdBy?: string;
}

export async function registerOAuthClient(input: RegisterOAuthClientInput) {
  if (!input.clientName.trim() || input.clientName.length > 255) {
    throw new OAuthRequestError('invalid_client_metadata', 'client_name is required and must be at most 255 characters');
  }
  if (input.redirectUris.length === 0 || input.redirectUris.length > 10) {
    throw new OAuthRequestError('invalid_client_metadata', 'Provide between one and ten redirect URIs');
  }
  const applicationType = input.applicationType ?? 'web';
  if (!['web', 'native'].includes(applicationType)) {
    throw new OAuthRequestError('invalid_client_metadata', 'application_type must be web or native');
  }
  const redirectUris = [
    ...new Set(input.redirectUris.map((uri) => validateRedirectUri(uri, applicationType))),
  ];
  const clientId = randomOpaqueToken('central_client_');
  const clientSecret =
    input.tokenEndpointAuthMethod === 'none' ? undefined : randomOpaqueToken('central_secret_');
  const clientSecretHash = clientSecret ? await hashClientSecret(clientSecret) : null;
  await db.insert(oauthClients).values({
    clientId,
    clientSecretHash,
    clientName: input.clientName.trim(),
    clientUri: input.clientUri,
    logoUri: input.logoUri,
    redirectUris,
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    applicationType,
    registrationType: input.registrationType,
    createdBy: input.createdBy,
  });
  return { clientId, clientSecret, redirectUris };
}
