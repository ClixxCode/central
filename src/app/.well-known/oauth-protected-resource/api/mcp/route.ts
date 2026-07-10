import { NextRequest, NextResponse } from 'next/server';
import { protectedResourceMetadata } from '@/lib/mcp/oauth-http';

export function GET(request: NextRequest) {
  return NextResponse.json(protectedResourceMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
