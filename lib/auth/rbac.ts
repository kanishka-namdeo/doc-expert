import { auth } from './index';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  }

  // Check if user has admin role
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, session.user.id),
  });

  if (user?.role !== 'admin') {
    return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  }

  return { ok: true as const, session, user };
}

export type AdminResult = Awaited<ReturnType<typeof requireAdmin>>;

/**
 * Reads the X-Org-Id header from a request.
 * Throws ForbiddenError if the header is missing.
 */
export function getOrgId(request: Request): string {
  const orgId = request.headers.get('X-Org-Id');
  if (!orgId) {
    throw new ForbiddenError('Organization not configured');
  }
  return orgId;
}

/**
 * Resolves the current user's orgId from the database.
 * Returns null if the user has no orgId assigned.
 */
export async function resolveUserOrgId(userId: string): Promise<string | null> {
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { orgId: true },
  });
  return user?.orgId ?? null;
}

/**
 * Validates that the user belongs to the given organization.
 * Returns the orgId if valid, null if the user has no org.
 */
export async function requireOrg(
  session: { user: { id: string } },
  expectedOrgId: string
): Promise<boolean> {
  const userOrgId = await resolveUserOrgId(session.user.id);
  if (!userOrgId) {
    return false;
  }
  return userOrgId === expectedOrgId;
}

/**
 * Attaches the user's orgId to a headers object as X-Org-Id.
 * Returns the orgId if found, null if the user has no org.
 */
export async function attachOrgIdToHeaders(
  userId: string,
  headers: Headers
): Promise<string | null> {
  const orgId = await resolveUserOrgId(userId);
  if (orgId) {
    headers.set('X-Org-Id', orgId);
  }
  return orgId;
}

