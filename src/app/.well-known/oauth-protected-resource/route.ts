import { oauthProtectedResourceMetadata } from '@/lib/oauth/config';
import { noStoreJson } from '@/lib/oauth/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return noStoreJson(oauthProtectedResourceMetadata());
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
