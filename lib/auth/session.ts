import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * Resolves the authenticated session and the user's orgId.
 * Returns a 401/403 response if not authenticated or no org.
 *
 * Usage in API routes:
 *   const session = await getAuthSession({ headers: request.headers });
 *   if (session.error) return session.error;
 *   const { userId, orgId } = session;
 */
export async function getAuthSession(opts: { headers: Headers }) {
  const isDev = process.env.NODE_ENV === 'development';
  const session = await auth.api.getSession({ headers: opts.headers });

  if (!session && !isDev) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }

  const userId = session?.user?.id || (isDev ? 'dev-user' : null);
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }

  // Resolve orgId from user table
  let orgId: string | null = null;
  if (session) {
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { orgId: true },
    });
    orgId = user?.orgId ?? null;
  }

  // In production, orgId is required. In dev, fall back gracefully.
  if (!orgId && !isDev) {
    return {
      error: NextResponse.json(
        { error: 'Organization not configured. Contact your administrator.' },
        { status: 403 }
      ),
    } as const;
  }

  // In dev mode, use a fallback orgId if not set
  const effectiveOrgId = orgId || 'org_dev_default';

  return {
    error: null,
    session,
    userId,
    orgId: effectiveOrgId,
  } as const;
}

/**
 * Returns a 403 response when the user has no orgId.
 */
export function orgRequiredResponse() {
  return NextResponse.json(
    { error: 'Organization not configured' },
    { status: 403 }
  );
}
