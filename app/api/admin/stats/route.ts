import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/rbac';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, conversation, auditLog } from '@/lib/db/schema';
import { count, eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/admin/stats');

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    // Get admin's orgId for scoped stats
    const adminUser = await db.query.user.findFirst({
      where: eq(user.id, adminResult.user.id),
      columns: { orgId: true },
    });
    const orgId = adminUser?.orgId;

    const userConditions = orgId ? [eq(user.orgId, orgId)] : [];
    const convConditions = orgId ? [eq(conversation.orgId, orgId)] : [];
    const auditConditions = orgId ? [eq(auditLog.orgId, orgId)] : [];

    const [totalUsers] = await db.select({ count: count() }).from(user).where(userConditions.length ? and(...userConditions) : undefined);
    const [totalConversations] = await db.select({ count: count() }).from(conversation).where(convConditions.length ? and(...convConditions) : undefined);
    const [totalAuditLogs] = await db.select({ count: count() }).from(auditLog).where(auditConditions.length ? and(...auditConditions) : undefined);

    return NextResponse.json({
      stats: {
        totalUsers: totalUsers?.count ?? 0,
        totalConversations: totalConversations?.count ?? 0,
        totalAuditLogs: totalAuditLogs?.count ?? 0,
        orgId,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch stats');
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
