import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/auth/extend-session');

export async function POST(request: Request) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    // Extend session by 7 days from now
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);

    await db
      .update(sessionTable)
      .set({ expiresAt: newExpiresAt, updatedAt: new Date() })
      .where(eq(sessionTable.userId, userId));

    await logAuditEvent(
      userId,
      'session.extended',
      'session',
      { newExpiresAt: newExpiresAt.toISOString(), orgId }
    );

    logger.info({ userId, newExpiresAt }, 'Session extended');
    return NextResponse.json({ success: true, expiresAt: newExpiresAt });
  } catch (error) {
    logger.error({ err: error, userId }, 'Session extension failed');
    return NextResponse.json({ error: 'Session extension failed' }, { status: 500 });
  }
}
