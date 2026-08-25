import { cookies } from 'next/headers';
import { getRealUser } from '@/lib/auth/session';
import { resolveOAuthClient } from '@/lib/oauth/clients';
import {
  authorizationRedirect,
  createAuthorizationTransaction,
  OAUTH_TRANSACTION_COOKIE,
  parseAuthorizationRequest,
  type AuthorizationTransaction,
} from '@/lib/oauth/authorization';
import {
  assertCanonicalRequestHost,
  oauthErrorResponse,
  oauthRedirectResponse,
  OAuthRequestError,
} from '@/lib/oauth/http';
import { signTransaction, verifyTransaction } from '@/lib/oauth/crypto';
import {
  createAuthorizationCode,
  findCoveringGrant,
  upsertGrant,
} from '@/lib/oauth/tokens';
import { enforceOAuthRateLimit } from '@/lib/oauth/rate-limit';
import { recordOAuthAudit } from '@/lib/oauth/audit';

export const dynamic = 'force-dynamic';

async function issueCode(transaction: AuthorizationTransaction, userId: string): Promise<URL> {
  const grant = await upsertGrant({
    userId,
    clientId: transaction.clientId,
    clientName: transaction.clientName,
    resource: transaction.resource,
    scopes: transaction.scopes,
  });
  const code = await createAuthorizationCode({
    userId,
    grantId: grant.id,
    clientId: transaction.clientId,
    redirectUri: transaction.redirectUri,
    resource: transaction.resource,
    scopes: transaction.scopes,
    codeChallenge: transaction.codeChallenge,
  });
  recordOAuthAudit({ userId, clientId: transaction.clientId, event: 'authorization.approved', outcome: 'success' });
  return authorizationRedirect(transaction, { code });
}

export async function GET(request: Request) {
  try {
    assertCanonicalRequestHost(request);
    await enforceOAuthRateLimit('authorize', 60);
    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');
    if (!clientId) throw new OAuthRequestError('invalid_request', 'client_id is required');
    const client = await resolveOAuthClient(clientId);
    const parsed = parseAuthorizationRequest(url.searchParams, client);
    const user = await getRealUser();
    if (!user) {
      const login = new URL('/login', url.origin);
      login.searchParams.set('callbackUrl', url.toString());
      return Response.redirect(login);
    }
    const transaction = createAuthorizationTransaction(parsed, client);
    const forceConsent = url.searchParams.get('prompt') === 'consent';
    if (!forceConsent) {
      const grant = await findCoveringGrant({
        userId: user.id,
        clientId: transaction.clientId,
        resource: transaction.resource,
        scopes: transaction.scopes,
      });
      if (grant) return Response.redirect(await issueCode(transaction, user.id));
    }
    if (url.searchParams.get('prompt') === 'none') {
      return Response.redirect(
        authorizationRedirect(transaction, {
          error: 'interaction_required',
          error_description: 'User consent is required',
        })
      );
    }
    return oauthRedirectResponse(new URL('/oauth/consent', url.origin), {
      'Set-Cookie': `${OAUTH_TRANSACTION_COOKIE}=${signTransaction({ ...transaction })}; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertCanonicalRequestHost(request);
    await enforceOAuthRateLimit('authorize', 60);
    const user = await getRealUser();
    if (!user) return oauthErrorResponse(new OAuthRequestError('access_denied', 'Authentication required', 401));
    const form = await request.formData();
    const cookieStore = await cookies();
    const transaction = verifyTransaction<AuthorizationTransaction>(
      cookieStore.get(OAUTH_TRANSACTION_COOKIE)?.value
    );
    if (!transaction || transaction.expiresAt < Date.now()) {
      return oauthErrorResponse(new OAuthRequestError('invalid_request', 'Authorization transaction expired'));
    }
    if (form.get('csrf') !== transaction.csrf) {
      return oauthErrorResponse(new OAuthRequestError('invalid_request', 'Invalid consent request'));
    }

    let target: URL;
    if (form.get('decision') === 'approve') {
      target = await issueCode(transaction, user.id);
    } else {
      recordOAuthAudit({ userId: user.id, clientId: transaction.clientId, event: 'authorization.denied', outcome: 'denied' });
      target = authorizationRedirect(transaction, {
        error: 'access_denied',
        error_description: 'The user denied the authorization request',
      });
    }
    return oauthRedirectResponse(target, {
      'Set-Cookie': `${OAUTH_TRANSACTION_COOKIE}=; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
