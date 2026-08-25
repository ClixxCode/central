import { authenticateOAuthClient, validateRedirectUri } from '@/lib/oauth/clients';
import { clientCredentialsFromRequest } from '@/lib/oauth/client-auth';
import { mcpResourceUrl } from '@/lib/oauth/config';
import {
  assertCanonicalRequestHost,
  noStoreJson,
  oauthErrorResponse,
  OAuthRequestError,
  parseScopes,
} from '@/lib/oauth/http';
import { exchangeAuthorizationCode, rotateRefreshToken } from '@/lib/oauth/tokens';
import { enforceOAuthRateLimit } from '@/lib/oauth/rate-limit';
import { recordOAuthAudit } from '@/lib/oauth/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let auditClientId: string | undefined;
  try {
    assertCanonicalRequestHost(request);
    await enforceOAuthRateLimit('token', 120);
    const form = await request.formData();
    const credentials = clientCredentialsFromRequest(request, form);
    auditClientId = credentials.clientId;
    const client = await authenticateOAuthClient(credentials);
    const grantType = form.get('grant_type');
    const requestedResource = form.get('resource');
    const resource = mcpResourceUrl();

    let result;
    if (grantType === 'authorization_code') {
      if (requestedResource !== resource) {
        throw new OAuthRequestError('invalid_target', `resource must be ${resource}`);
      }
      const code = form.get('code');
      const redirectUri = form.get('redirect_uri');
      const codeVerifier = form.get('code_verifier');
      if (typeof code !== 'string' || typeof redirectUri !== 'string' || typeof codeVerifier !== 'string') {
        throw new OAuthRequestError('invalid_request', 'code, redirect_uri, and code_verifier are required');
      }
      const normalizedRedirectUri = validateRedirectUri(redirectUri, client.applicationType);
      if (!client.redirectUris.includes(normalizedRedirectUri)) {
        throw new OAuthRequestError('invalid_grant', 'redirect_uri is not registered for this client');
      }
      result = await exchangeAuthorizationCode({
        code,
        clientId: client.clientId,
        redirectUri: normalizedRedirectUri,
        resource,
        codeVerifier,
      });
    } else if (grantType === 'refresh_token') {
      if (requestedResource !== null && requestedResource !== resource) {
        throw new OAuthRequestError('invalid_target', `resource must be ${resource}`);
      }
      const refreshToken = form.get('refresh_token');
      if (typeof refreshToken !== 'string') {
        throw new OAuthRequestError('invalid_request', 'refresh_token is required');
      }
      const requestedScope = form.get('scope');
      result = await rotateRefreshToken({
        refreshToken,
        clientId: client.clientId,
        resource,
        requestedScopes: typeof requestedScope === 'string' ? parseScopes(requestedScope) : undefined,
      });
    } else {
      throw new OAuthRequestError('unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
    }
    recordOAuthAudit({ clientId: client.clientId, event: `token.${grantType}`, outcome: 'success' });
    return noStoreJson(result);
  } catch (error) {
    recordOAuthAudit({ clientId: auditClientId, event: 'token.failed', outcome: 'error' });
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
