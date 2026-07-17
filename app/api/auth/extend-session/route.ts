import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';

const logger = getLogger('api/auth/extend-session');

export async function POST(request: Request) {
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Extend session by 7 days from now
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);

    await db
      .update(sessionTable)
      .set({ expiresAt: newExpiresAt, updatedAt: new Date() })
      .where(eq(sessionTable.token, authSession.session.token));

    await logAuditEvent(
      authSession.user.id,
      'session.extended',
      'session:' + authSession.session.token.slice(0, 16),
      { newExpiresAt: newExpiresAt.toISOString() }
    );

    logger.info({ userId: authSession.user.id, newExpiresAt }, 'Session extended');
    return NextResponse.json({ success: true, expiresAt: newExpiresAt });
  } catch (error) {
    logger.error({ err: error, userId: authSession.user.id }, 'Session extension failed');
    return NextResponse.json({ error: 'Session extension failed' }, { status: 500 });
  }
}
