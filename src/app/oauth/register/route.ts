import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError, registerMcpOAuthClient } from '@/lib/mcp/oauth-service';
import { MCP_SCOPES, oauthErrorResponse, oauthServiceErrorResponse } from '@/lib/mcp/oauth-http';

type RegistrationRequest = {
  client_name?: unknown;
  redirect_uris?: unknown;
  scope?: unknown;
  token_endpoint_auth_method?: unknown;
};

function requestedScopes(scope: unknown): string[] {
  const values = typeof scope === 'string' ? scope.split(' ') : [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function POST(request: NextRequest) {
  let body: RegistrationRequest;
  try {
    body = await request.json();
  } catch {
    return oauthErrorResponse('invalid_client_metadata', 'Client registration must contain a JSON object');
  }

  const redirectUris = Array.isArray(body.redirect_uris) && body.redirect_uris.every((uri) => typeof uri === 'string')
    ? body.redirect_uris
    : [];
  const scopes = requestedScopes(body.scope);
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
    return oauthErrorResponse('invalid_client_metadata', 'Only public PKCE clients are supported');
  }
  if (scopes.length === 0 || scopes.some((scope) => !MCP_SCOPES.includes(scope as typeof MCP_SCOPES[number]))) {
    return oauthErrorResponse('invalid_client_metadata', 'At least one supported scope is required');
  }

  try {
    const client = await registerMcpOAuthClient({
      clientId: `mcp_client_${crypto.randomBytes(24).toString('base64url')}`,
      name: typeof body.client_name === 'string' ? body.client_name : 'MCP client',
      redirectUris,
      allowedScopes: scopes,
    });
    return NextResponse.json({
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      scope: client.allowedScopes.join(' '),
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof McpOAuthError) {
      return oauthErrorResponse('invalid_client_metadata', error.message);
    }
    return oauthServiceErrorResponse(error);
  }
}
