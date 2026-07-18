import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { notification } from '@/lib/db/schema';

export type NotificationType =
  | 'document_approved'
  | 'document_rejected'
  | 'document_shared'
  | 'conversation_shared';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message?: string,
  data?: Record<string, unknown>
): Promise<void> {
  await db.insert(notification).values({
    id: randomUUID(),
    userId,
    type,
    title,
    message: message ?? null,
    data: data ? JSON.stringify(data) : null,
    createdAt: new Date(),
  });
}
