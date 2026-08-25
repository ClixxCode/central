import { registerOAuthClient } from '@/lib/oauth/clients';
import {
  assertCanonicalRequestHost,
  noStoreJson,
  oauthErrorResponse,
  OAuthRequestError,
} from '@/lib/oauth/http';
import { enforceOAuthRateLimit } from '@/lib/oauth/rate-limit';
import { recordOAuthAudit } from '@/lib/oauth/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertCanonicalRequestHost(request);
    await enforceOAuthRateLimit('register', 20);
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new OAuthRequestError('invalid_client_metadata', 'Content-Type must be application/json');
    }
    const body = (await request.json()) as Record<string, unknown>;
    const method = body.token_endpoint_auth_method ?? 'none';
    if (!['none', 'client_secret_basic', 'client_secret_post'].includes(String(method))) {
      throw new OAuthRequestError('invalid_client_metadata', 'Unsupported token_endpoint_auth_method');
    }
    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.some((uri) => typeof uri !== 'string')) {
      throw new OAuthRequestError('invalid_redirect_uri', 'redirect_uris must be an array of strings');
    }
    if (
      body.grant_types &&
      (!Array.isArray(body.grant_types) ||
        !body.grant_types.includes('authorization_code') ||
        body.grant_types.some((value) => !['authorization_code', 'refresh_token'].includes(String(value))))
    ) {
      throw new OAuthRequestError('invalid_client_metadata', 'Only authorization_code and refresh_token grants are supported');
    }
    if (
      body.response_types &&
      (!Array.isArray(body.response_types) ||
        body.response_types.length !== 1 ||
        body.response_types[0] !== 'code')
    ) {
      throw new OAuthRequestError('invalid_client_metadata', 'Only response_type code is supported');
    }
    if (body.application_type && !['web', 'native'].includes(String(body.application_type))) {
      throw new OAuthRequestError('invalid_client_metadata', 'application_type must be web or native');
    }
    const registered = await registerOAuthClient({
      clientName: typeof body.client_name === 'string' ? body.client_name : 'MCP Client',
      redirectUris: body.redirect_uris as string[],
      tokenEndpointAuthMethod: method as 'none' | 'client_secret_basic' | 'client_secret_post',
      applicationType: typeof body.application_type === 'string' ? body.application_type : 'web',
      clientUri: typeof body.client_uri === 'string' ? body.client_uri : undefined,
      logoUri: typeof body.logo_uri === 'string' ? body.logo_uri : undefined,
      registrationType: 'dynamic',
    });
    recordOAuthAudit({ clientId: registered.clientId, event: 'client.dynamic_registered', outcome: 'success' });
    return noStoreJson(
      {
        client_id: registered.clientId,
        client_secret: registered.clientSecret,
        client_secret_expires_at: registered.clientSecret ? 0 : undefined,
        client_name: typeof body.client_name === 'string' ? body.client_name : 'MCP Client',
        redirect_uris: registered.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: method,
        application_type: typeof body.application_type === 'string' ? body.application_type : 'web',
      },
      { status: 201 }
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
