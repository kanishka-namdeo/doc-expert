import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth/rbac';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { groupMember, groupTable, documentPermission, user as userTable } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { updateDocumentAcl } from '@/app/api/documents/[id]/permissions/route';

const logger = getLogger('api/admin/groups/[id]/members');

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

    // Fetch members for this group
    const members = await db.query.groupMember.findMany({
      where: eq(groupMember.groupId, groupId),
    });

    // Enrich with user details
    const userIds = members.map((m) => m.userId);
    const users = await db.query.user.findMany({
      where: inArray(userTable.id, userIds),
      columns: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: userMap.get(m.userId)?.name ?? null,
        email: userMap.get(m.userId)?.email ?? '',
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list group members');
    return NextResponse.json(
      { error: 'Failed to list group members' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

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

    // Verify target user exists and is in the same org
    const targetUser = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { orgId: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.orgId !== adminUser?.orgId) {
      return NextResponse.json(
        { error: 'Cannot add users from other organizations' },
        { status: 400 }
      );
    }

    // Check for duplicate membership
    const existing = await db.query.groupMember.findFirst({
      where: and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 409 }
      );
    }

    // Add member
    await db.insert(groupMember).values({
      id: randomUUID(),
      groupId,
      userId,
      createdAt: new Date(),
    });

    // Update ACLs for documents where this group has permissions
    const perms = await db.query.documentPermission.findMany({
      where: eq(documentPermission.groupId, groupId),
      columns: { documentId: true },
    });

    for (const perm of perms) {
      await updateDocumentAcl(perm.documentId);
    }

    await logAuditEvent(
      adminResult.user.id,
      'group.member.add',
      `group:${groupId}`,
      { userId, groupId, orgId: adminUser?.orgId }
    );

    logger.info({ groupId, userId, addedBy: adminResult.user.id }, 'Member added to group');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to add group member');
    return NextResponse.json(
      { error: 'Failed to add group member' },
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

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

    // Verify membership exists
    const membership = await db.query.groupMember.findFirst({
      where: and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ),
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of this group' },
        { status: 404 }
      );
    }

    // Remove member
    await db.delete(groupMember).where(
      and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      )
    );

    // Update ACLs for documents where this group has permissions
    const perms = await db.query.documentPermission.findMany({
      where: eq(documentPermission.groupId, groupId),
      columns: { documentId: true },
    });

    for (const perm of perms) {
      await updateDocumentAcl(perm.documentId);
    }

    await logAuditEvent(
      adminResult.user.id,
      'group.member.remove',
      `group:${groupId}`,
      { userId, groupId, orgId: adminUser?.orgId }
    );

    logger.info({ groupId, userId, removedBy: adminResult.user.id }, 'Member removed from group');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove group member');
    return NextResponse.json(
      { error: 'Failed to remove group member' },
      { status: 500 }
    );
  }
}
