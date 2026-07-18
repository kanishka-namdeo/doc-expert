import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/notifications');

const markReadSchema = z.object({
  notificationId: z.string(),
});

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId } = session;

  try {
    const notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(20);

    const unreadNotifications = await db
      .select({ id: notification.id })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        data: n.data ? JSON.parse(n.data) : null,
      })),
      unreadCount: unreadNotifications.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch notifications');
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId } = session;

  try {
    const body = await request.json();
    const { notificationId } = markReadSchema.parse(body);

    const [existing] = await db
      .select()
      .from(notification)
      .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)));

    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(eq(notification.id, notificationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to mark notification as read');
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
