import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth/rbac';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { groupTable, groupMember, user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const logger = getLogger('api/admin/groups');

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const body = await request.json();
    const { name, description } = createSchema.parse(body);

    // Get admin's orgId
    const adminUser = await db.query.user.findFirst({
      where: eq(userTable.id, adminResult.user.id),
      columns: { orgId: true },
    });

    if (!adminUser?.orgId) {
      return NextResponse.json(
        { error: 'Organization not configured' },
        { status: 403 }
      );
    }

    const groupId = randomUUID();
    const now = new Date();

    await db.insert(groupTable).values({
      id: groupId,
      orgId: adminUser.orgId,
      name,
      description: description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(
      adminResult.user.id,
      'group.create',
      `group:${groupId}`,
      { name, orgId: adminUser.orgId }
    );

    logger.info({ groupId, name, orgId: adminUser.orgId }, 'Group created');
    return NextResponse.json({ success: true, groupId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    logger.error({ err: error }, 'Failed to create group');
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    // Get admin's orgId
    const adminUser = await db.query.user.findFirst({
      where: eq(userTable.id, adminResult.user.id),
      columns: { orgId: true },
    });

    if (!adminUser?.orgId) {
      return NextResponse.json(
        { error: 'Organization not configured' },
        { status: 403 }
      );
    }

    const groups = await db.query.groupTable.findMany({
      where: eq(groupTable.orgId, adminUser.orgId),
    });

    // Enrich with member counts
    const enriched = await Promise.all(
      groups.map(async (group) => {
        const members = await db.query.groupMember.findMany({
          where: eq(groupMember.groupId, group.id),
        });
        return {
          ...group,
          memberCount: members.length,
        };
      })
    );

    return NextResponse.json({ groups: enriched });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list groups');
    return NextResponse.json(
      { error: 'Failed to list groups' },
      { status: 500 }
    );
  }
}
