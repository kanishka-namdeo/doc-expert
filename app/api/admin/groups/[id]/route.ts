import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { groupTable, groupMember, documentPermission, user as userTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { updateDocumentAcl } from '@/app/api/documents/[id]/permissions/route';

const logger = getLogger('api/admin/groups/[id]');

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const { id: groupId } = await params;

    const adminUser = await db.query.user.findFirst({
      where: eq(userTable.id, adminResult.user.id),
      columns: { orgId: true },
    });

    const group = await db.query.groupTable.findFirst({
      where: eq(groupTable.id, groupId),
    });

    if (!group || group.orgId !== adminUser?.orgId) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const members = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      })
      .from(groupMember)
      .innerJoin(userTable, eq(groupMember.userId, userTable.id))
      .where(eq(groupMember.groupId, groupId));

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        orgId: group.orgId,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
      members,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get group');
    return NextResponse.json(
      { error: 'Failed to get group' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const { id: groupId } = await params;
    const body = await request.json();
    const { name, description } = updateSchema.parse(body);

    // Verify group exists and belongs to admin's org
    const adminUser = await db.query.user.findFirst({
      where: eq(userTable.id, adminResult.user.id),
      columns: { orgId: true },
    });

    const group = await db.query.groupTable.findFirst({
      where: eq(groupTable.id, groupId),
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.orgId !== adminUser?.orgId) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    updates.updatedAt = new Date();

    await db.update(groupTable).set(updates).where(eq(groupTable.id, groupId));

    await logAuditEvent(
      adminResult.user.id,
      'group.update',
      `group:${groupId}`,
      { orgId: adminUser?.orgId }
    );

    logger.info({ groupId, updates }, 'Group updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    logger.error({ err: error }, 'Failed to update group');
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const { id: groupId } = await params;

    // Verify group exists and belongs to admin's org
    const adminUser = await db.query.user.findFirst({
      where: eq(userTable.id, adminResult.user.id),
      columns: { orgId: true },
    });

    const group = await db.query.groupTable.findFirst({
      where: eq(groupTable.id, groupId),
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.orgId !== adminUser?.orgId) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Find all document permissions granted via this group
    const perms = await db.query.documentPermission.findMany({
      where: eq(documentPermission.groupId, groupId),
      columns: { documentId: true },
    });

    // Delete all permissions for this group
    await db.delete(documentPermission).where(eq(documentPermission.groupId, groupId));

    // Delete group members
    await db.delete(groupMember).where(eq(groupMember.groupId, groupId));

    // Delete the group
    await db.delete(groupTable).where(eq(groupTable.id, groupId));

    // Update ACLs for all affected documents
    const affectedDocIds = [...new Set(perms.map((p) => p.documentId))];
    for (const docId of affectedDocIds) {
      await updateDocumentAcl(docId);
    }

    await logAuditEvent(
      adminResult.user.id,
      'group.delete',
      `group:${groupId}`,
      { name: group.name, affectedDocuments: affectedDocIds.length, orgId: adminUser?.orgId }
    );

    logger.info({ groupId, name: group.name, affectedDocuments: affectedDocIds.length }, 'Group deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete group');
    return NextResponse.json(
      { error: 'Failed to delete group' },
      { status: 500 }
    );
  }
}
