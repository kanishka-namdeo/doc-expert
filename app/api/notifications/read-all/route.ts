import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/notifications/read-all');

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId } = session;

  try {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to mark all notifications as read');
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
