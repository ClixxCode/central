import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { issueMcpAuthorizationCode, validateMcpAuthorizationRequest } from '@/lib/mcp/oauth-service';
import {
  oauthErrorResponse,
  oauthServiceErrorResponse,
  redirectWithOAuthParameters,
  verifyAuthorizationRequest,
} from '@/lib/mcp/oauth-http';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return oauthErrorResponse('login_required', 'Sign in to Central before authorizing a client', 401);

  const formData = await request.formData();
  const authorizationRequest = verifyAuthorizationRequest(String(formData.get('request') ?? ''));
  if (!authorizationRequest) return oauthErrorResponse('invalid_request', 'The authorization request is invalid or expired');

  try {
    const validated = await validateMcpAuthorizationRequest(authorizationRequest);
    if (formData.get('decision') !== 'approve') {
      return redirectWithOAuthParameters(validated.redirectUri, {
        error: 'access_denied', error_description: 'The resource owner denied the authorization request', state: authorizationRequest.state,
      });
    }

    const result = await issueMcpAuthorizationCode({
      clientId: validated.clientId,
      userId: user.id,
      redirectUri: validated.redirectUri,
      scopes: validated.scopes,
      codeChallenge: validated.codeChallenge,
    });
    return redirectWithOAuthParameters(validated.redirectUri, { code: result.authorizationCode, state: authorizationRequest.state });
  } catch (error) {
    return oauthServiceErrorResponse(error);
  }
}
