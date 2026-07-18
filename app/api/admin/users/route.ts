import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/rbac';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq, desc, like, or, count, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';

const logger = getLogger('api/admin/users');

const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const url = new URL(request.url);
    const { page: pageStr, limit: limitStr, search, role } = querySchema.parse({
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '20',
      search: url.searchParams.get('search'),
      role: url.searchParams.get('role'),
    });

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    // Get the admin's orgId to scope user queries
    const adminUser = await db.query.user.findFirst({
      where: eq(user.id, adminResult.user.id),
      columns: { orgId: true },
    });
    const adminOrgId = adminUser?.orgId;

    const conditions: ReturnType<typeof eq>[] = [];
    if (adminOrgId) {
      conditions.push(eq(user.orgId, adminOrgId));
    }
    if (search) {
      conditions.push(
        or(
          like(user.email, `%${search}%`),
          like(user.name || '', `%${search}%`)
        ) as ReturnType<typeof eq>
      );
    }
    if (role) {
      conditions.push(eq(user.role, role));
    }
    const whereClause = conditions.length > 0 ? conditions.reduce((a, b) => and(a, b)!) : undefined;

    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch users');
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
    }

    const validRoles = ['admin', 'editor', 'viewer', 'user'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Verify target user is in the same org
    const adminUser = await db.query.user.findFirst({
      where: eq(user.id, adminResult.user.id),
      columns: { orgId: true },
    });

    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { orgId: true },
    });

    if (adminUser?.orgId && targetUser?.orgId && adminUser.orgId !== targetUser.orgId) {
      return NextResponse.json({ error: 'Cannot modify users in other organizations' }, { status: 403 });
    }

    await db
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.id, userId));

    await logAuditEvent(
      adminResult.user.id,
      'user.role_changed',
      'user:' + userId,
      { newRole: role, changedBy: adminResult.user.id, orgId: adminUser?.orgId }
    );

    logger.info({ userId, newRole: role, changedBy: adminResult.user.id }, 'User role updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update user role');
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
