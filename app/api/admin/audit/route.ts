import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/rbac';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog, user } from '@/lib/db/schema';
import { eq, desc, like, and, sql, between, count, inArray } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';

const logger = getLogger('api/admin/audit');

const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  userId: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const url = new URL(request.url);
    const { page: pageStr, limit: limitStr, userId, action, fromDate, toDate } = querySchema.parse({
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '50',
      userId: url.searchParams.get('userId'),
      action: url.searchParams.get('action'),
      fromDate: url.searchParams.get('fromDate'),
      toDate: url.searchParams.get('toDate'),
    });

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    // Get admin's orgId for scoped queries
    const adminUser = await db.query.user.findFirst({
      where: eq(user.id, adminResult.user.id),
      columns: { orgId: true },
    });
    const adminOrgId = adminUser?.orgId;

    const conditions: ReturnType<typeof eq>[] = [];
    if (adminOrgId) conditions.push(eq(auditLog.orgId, adminOrgId));
    if (userId) conditions.push(eq(auditLog.userId, userId));
    if (action) conditions.push(eq(auditLog.action, action));
    if (fromDate) conditions.push(sql`${auditLog.timestamp} >= ${new Date(fromDate).getTime()}` as ReturnType<typeof eq>);
    if (toDate) conditions.push(sql`${auditLog.timestamp} <= ${new Date(toDate).getTime()}` as ReturnType<typeof eq>);

    const whereClause = conditions.length > 0
      ? conditions.reduce((a, b) => and(a, b)!)
      : undefined;

    const logs = await db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resource: auditLog.resource,
        timestamp: auditLog.timestamp,
        metadata: auditLog.metadata,
      })
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.timestamp))
      .limit(limit)
      .offset(offset);

    // Enrich with user emails
    const userIds = [...new Set(logs.map((log) => log.userId))];
    const users = userIds.length > 0
      ? await db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.id, userIds))
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLog)
      .where(whereClause);

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        userEmail: userMap.get(log.userId) || 'Unknown',
      })),
      pagination: {
        page,
        limit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch audit logs');
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
