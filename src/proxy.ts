import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/invite'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // API routes that should be publicly accessible
  const isAuthApi = pathname.startsWith('/api/auth');
  const isInngestApi = pathname.startsWith('/api/inngest');

  // Allow public routes, auth API, and Inngest API (secured by signing key)
  if (isPublicRoute || isAuthApi || isInngestApi) {
    // If user is already logged in and trying to access login/signup, redirect to dashboard
    if (req.auth && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/my-tasks', req.url));
    }
    return NextResponse.next();
  }

  // Allow bots/crawlers through so OG meta tags are served for link previews
  if (!req.auth) {
    const userAgent = req.headers.get('user-agent') || '';
    const isBot = /bot|crawler|spider|slackbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|discord/i.test(userAgent);
    if (!isBot) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/blob).*)',
  ],
};
