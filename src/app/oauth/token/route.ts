import { NextRequest, NextResponse } from 'next/server';
import { exchangeMcpAuthorizationCode, rotateMcpRefreshToken } from '@/lib/mcp/oauth-service';
import { oauthErrorResponse, oauthServiceErrorResponse } from '@/lib/mcp/oauth-http';

function tokenResponse(result: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}) {
  const expiresIn = Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));
  return NextResponse.json({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: result.refreshToken,
    scope: result.scopes.join(' '),
  }, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return oauthErrorResponse('invalid_request', 'Token requests must use application/x-www-form-urlencoded');
  }

  const body = await request.formData();
  const grantType = String(body.get('grant_type') ?? '');
  const clientId = String(body.get('client_id') ?? '').trim();
  if (!clientId) return oauthErrorResponse('invalid_client', 'client_id is required', 401);

  try {
    if (grantType === 'authorization_code') {
      const code = String(body.get('code') ?? '');
      const redirectUri = String(body.get('redirect_uri') ?? '');
      const codeVerifier = String(body.get('code_verifier') ?? '');
      if (!code || !redirectUri || !codeVerifier) {
        return oauthErrorResponse('invalid_request', 'code, redirect_uri, and code_verifier are required');
      }
      return tokenResponse(await exchangeMcpAuthorizationCode({ clientId, authorizationCode: code, redirectUri, codeVerifier }));
    }
    if (grantType === 'refresh_token') {
      const refreshToken = String(body.get('refresh_token') ?? '');
      if (!refreshToken) return oauthErrorResponse('invalid_request', 'refresh_token is required');
      return tokenResponse(await rotateMcpRefreshToken({ clientId, refreshToken }));
    }
    return oauthErrorResponse('unsupported_grant_type', 'Only authorization_code and refresh_token grants are supported');
  } catch (error) {
    return oauthServiceErrorResponse(error);
  }
}
