import { db } from './db';
import { auditLog } from './db/schema';

export async function logAuditEvent(
  userId: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(auditLog).values({
    userId,
    action,
    resource,
    timestamp: new Date(),
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}
