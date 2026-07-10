import { NextRequest, NextResponse } from 'next/server';
import { authorizationServerMetadata } from '@/lib/mcp/oauth-http';

export function GET(request: NextRequest) {
  return NextResponse.json(authorizationServerMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
