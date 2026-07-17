import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, session as sessionTable, auditLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/account/delete');

export async function POST(request: Request) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    // 1. Delete all user's documents from Qdrant (non-blocking if Qdrant unavailable)
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    try {
      await fetch(`${qdrantUrl}/collections/documents/points/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: 'userId',
                match: {
                  value: userId,
                },
              },
              {
                key: 'orgId',
                match: {
                  value: orgId,
                },
              },
            ],
          },
        }),
      });
    } catch (qdrantErr) {
      logger.warn({ err: qdrantErr }, 'Qdrant cleanup skipped (unavailable)');
    }
    // 2. Delete audit logs (org-scoped)
    await db.delete(auditLog).where(and(eq(auditLog.userId, userId), eq(auditLog.orgId, orgId)));

    // 3. Delete sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // 4. Log the deletion event (before deleting user)
    await logAuditEvent(userId, 'account.delete', `user:${userId}`, { orgId });

    // 5. Delete user
    await db.delete(user).where(eq(user.id, userId));

    logger.info({ userId }, 'Account deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to delete account');
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
