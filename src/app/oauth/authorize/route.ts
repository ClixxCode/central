import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { McpOAuthError, validateMcpAuthorizationRequest } from '@/lib/mcp/oauth-service';
import {
  escapeHtml,
  oauthServiceErrorResponse,
  parseAuthorizationRequest,
  signAuthorizationRequest,
} from '@/lib/mcp/oauth-http';

export async function GET(request: NextRequest) {
  const authorizationRequest = parseAuthorizationRequest(request.nextUrl.searchParams);
  if (authorizationRequest instanceof McpOAuthError) {
    return oauthServiceErrorResponse(authorizationRequest);
  }

  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const validated = await validateMcpAuthorizationRequest(authorizationRequest);
    const signedRequest = signAuthorizationRequest({ ...authorizationRequest, scopes: validated.scopes });
    const scopes = validated.scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join('');
    return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Authorize ${escapeHtml(validated.clientName)}</title></head><body><main><h1>Connect ${escapeHtml(validated.clientName)}?</h1><p>This will allow the client to access Central using your account.</p><p>Requested permissions:</p><ul>${scopes}</ul><form method="post" action="/oauth/consent"><input type="hidden" name="request" value="${escapeHtml(signedRequest)}"><button type="submit" name="decision" value="approve">Allow</button><button type="submit" name="decision" value="deny">Deny</button></form></main></body></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return oauthServiceErrorResponse(error);
  }
}
