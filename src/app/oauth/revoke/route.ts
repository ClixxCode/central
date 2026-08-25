import { authenticateOAuthClient } from '@/lib/oauth/clients';
import { clientCredentialsFromRequest } from '@/lib/oauth/client-auth';
import { assertCanonicalRequestHost, oauthErrorResponse } from '@/lib/oauth/http';
import { revokeOpaqueToken } from '@/lib/oauth/tokens';
import { enforceOAuthRateLimit } from '@/lib/oauth/rate-limit';
import { recordOAuthAudit } from '@/lib/oauth/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertCanonicalRequestHost(request);
    await enforceOAuthRateLimit('revoke', 120);
    const form = await request.formData();
    const credentials = clientCredentialsFromRequest(request, form);
    const client = await authenticateOAuthClient(credentials);
    const token = form.get('token');
    if (typeof token === 'string') await revokeOpaqueToken(token, client.clientId);
    recordOAuthAudit({ clientId: client.clientId, event: 'token.revoked', outcome: 'success' });
    return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
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
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
