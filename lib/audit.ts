import crypto from 'crypto';
import { db } from './db';
import { auditLog } from './db/schema';
import { getLogger } from './logger';

const auditLogger = getLogger('audit');

export async function logAuditEvent(
  userId: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      timestamp: Date.now(),
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
    
    auditLogger.info({ userId, action, resource, metadata }, 'Audit event recorded');
  } catch (error) {
    auditLogger.error({ err: error, userId, action, resource }, 'Failed to record audit event');
    throw error; // Re-throw so caller knows audit failed
  }
}
