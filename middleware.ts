import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { checkRateLimit, getRateLimitConfig } from '@/lib/rate-limiter';

const logger = getLogger('middleware');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CSRF_EXEMPT_PATHS = ['/api/auth/'];

export default function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const { method, nextUrl } = request;
  const pathname = nextUrl.pathname;

  // Log incoming request
  logger.info(
    {
      method,
      path: pathname,
      requestId,
    },
    'Incoming request'
  );

  // CSRF protection for state-changing requests
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    const isCsrfExempt = CSRF_EXEMPT_PATHS.some((prefix) => pathname.startsWith(prefix));
    if (!isCsrfExempt) {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host');

      // Check Origin header first, fall back to Referer
      const requestOrigin = origin || (referer ? new URL(referer).origin : null);

      if (requestOrigin) {
        const expectedOrigin = APP_URL;
        if (requestOrigin !== expectedOrigin) {
          logger.warn(
            { requestId, method, pathname, origin: requestOrigin, expectedOrigin },
            'CSRF check failed'
          );
          const duration = Date.now() - start;
          logger.info({ requestId, method, path: pathname, status: 403, duration: `${duration}ms` }, 'Request completed');
          return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }

  // Rate limiting for API routes
  const rateLimitConfig = getRateLimitConfig(pathname);
  if (rateLimitConfig) {
    const sessionCookie = request.cookies.get('better-auth.session_token');
    const forwarded = request.headers.get('x-forwarded-for');
    const userId = sessionCookie?.value || (forwarded ? forwarded.split(',')[0].trim() : 'anonymous');
    const rateLimitKey = `${pathname}:${userId}`;

    const result = checkRateLimit(rateLimitKey, rateLimitConfig.limit, rateLimitConfig.windowMs);

    if (!result.allowed) {
      logger.warn(
        { requestId, method, pathname, userId, limit: rateLimitConfig.limit },
        'Rate limit exceeded'
      );
      const duration = Date.now() - start;
      logger.info({ requestId, method, path: pathname, status: 429, duration: `${duration}ms` }, 'Request completed');
      const response = new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(rateLimitConfig.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt.getTime() / 1000)),
        },
      });
      return response;
    }

    // Attach rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
    response.headers.set('X-Request-ID', requestId);

    const duration = Date.now() - start;
    logger.info(
      {
        method,
        path: pathname,
        status: 200,
        duration: `${duration}ms`,
        requestId,
      },
      'Request completed'
    );

    return response;
  }

  const sessionCookie = request.cookies.get('better-auth.session_token');
  const isAuthenticated = !!sessionCookie?.value;

  const isAuthRoute = pathname.startsWith('/api/auth');
  const isLoginPage = pathname === '/login';
  const isSignupPage = pathname === '/signup';
  const isForgotPasswordPage = pathname === '/forgot-password';
  const isResetPasswordPage = pathname === '/reset-password';
  const isApiRoute = pathname.startsWith('/api/');
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApiRoute = pathname.startsWith('/api/admin');

  // Protect admin routes - require authentication
  if (isAdminRoute && !isAuthenticated) {
    const duration = Date.now() - start;
    logger.info({ requestId, method, path: pathname, status: 302, duration: `${duration}ms` }, 'Request completed');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isAdminApiRoute && !isAuthenticated) {
    const duration = Date.now() - start;
    logger.info({ requestId, method, path: pathname, status: 401, duration: `${duration}ms` }, 'Request completed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Redirect unauthenticated users to login
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && !isAuthenticated && !isAuthRoute && !isLoginPage && !isSignupPage && !isForgotPasswordPage && !isResetPasswordPage && !isApiRoute) {
    const duration = Date.now() - start;
    logger.info({ requestId, method, path: pathname, status: 302, duration: `${duration}ms` }, 'Request completed');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isDev && !isAuthenticated && !isAuthRoute && !isLoginPage && !isSignupPage && !isForgotPasswordPage && !isResetPasswordPage && !isApiRoute) {
    return NextResponse.next();
  }
  if (!isAuthenticated && isApiRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  if (isAuthenticated && isLoginPage) {
    const duration = Date.now() - start;
    logger.info({ requestId, method, path: pathname, status: 302, duration: `${duration}ms` }, 'Request completed');
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();
  response.headers.set('X-Request-ID', requestId);

  // Note: orgId resolution happens in API routes via getOrgId() helper
  // because SQLite is not available in Edge middleware runtime.
  // The X-Org-Id header is populated by API routes after querying the user table.

  const duration = Date.now() - start;
  logger.info(
    {
      method,
      path: pathname,
      status: 200,
      duration: `${duration}ms`,
      requestId,
    },
    'Request completed'
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
