import { OAuthRequestError } from './http';
import type { OAuthTokenEndpointAuthMethod } from '@/lib/db/schema';

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret?: string;
  method: OAuthTokenEndpointAuthMethod;
}

export function clientCredentialsFromRequest(
  request: Request,
  form: FormData
): OAuthClientCredentials {
  const authorization = request.headers.get('authorization');
  const formClientId = form.get('client_id');
  const formClientSecret = form.get('client_secret');
  if (authorization?.startsWith('Basic ')) {
    if (formClientId || formClientSecret) {
      throw new OAuthRequestError('invalid_request', 'Use only one client authentication method');
    }
    let decoded: string;
    try {
      decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    } catch {
      throw new OAuthRequestError('invalid_client', 'Malformed HTTP Basic credentials', 401);
    }
    const separator = decoded.indexOf(':');
    if (separator < 0) throw new OAuthRequestError('invalid_client', 'Malformed HTTP Basic credentials', 401);
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      method: 'client_secret_basic',
    };
  }
  if (typeof formClientId !== 'string' || !formClientId) {
    throw new OAuthRequestError('invalid_client', 'client_id is required', 401);
  }
  return {
    clientId: formClientId,
    clientSecret: typeof formClientSecret === 'string' && formClientSecret ? formClientSecret : undefined,
    method: typeof formClientSecret === 'string' && formClientSecret
      ? 'client_secret_post'
      : 'none',
  };
}
