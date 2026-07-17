import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAuthSession } from '@/lib/auth/session';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  documentPermission,
  user as userTable,
  groupTable,
  groupMember,
  document as documentTable,
} from '@/lib/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { QdrantClient } from '@qdrant/js-client-rest';

const logger = getLogger('api/documents/[id]/permissions');

/**
 * Resolves the effective permission level a user has on a document.
 * Returns 'owner' if the user owns the document, otherwise the highest
 * granted permission (admin > write > read), or null if no access.
 */
export async function resolveUserPermission(
  documentId: string,
  userId: string
): Promise<'owner' | 'admin' | 'write' | 'read' | null> {
  // Check ownership via database (primary) and Qdrant (fallback)
  const doc = await db.query.document.findFirst({
    where: eq(documentTable.id, documentId),
    columns: { userId: true },
  });

  if (doc?.userId === userId) {
    return 'owner';
  }

  // Fallback: check Qdrant for ownership (for documents that exist only in vector store)
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const client = new QdrantClient({ url: qdrantUrl });
  try {
    const ownerCheck = await client.scroll('documents', {
      filter: {
        must: [
          { key: 'documentId', match: { value: documentId } },
          { key: 'userId', match: { value: userId } },
        ],
      },
      limit: 1,
      with_payload: false,
      with_vector: false,
    });
    if ((ownerCheck.points as unknown[]).length > 0) {
      return 'owner';
    }
  } catch {
    // Qdrant unavailable; continue with DB-only check
  }

  // Check explicit permissions
  const perms = await db.query.documentPermission.findMany({
    where: and(
      eq(documentPermission.documentId, documentId),
      eq(documentPermission.userId, userId)
    ),
  });

  if (perms.length === 0) return null;

  // Return highest permission
  const levels = perms.map((p) => p.permission as string);
  if (levels.includes('admin')) return 'admin';
  if (levels.includes('write')) return 'write';
  return 'read';
}

/**
 * Builds the ACL for a document: list of userIds that should have access.
 * Includes: owner, users with direct permissions, members of groups with permissions.
 */
export async function buildDocumentAcl(documentId: string): Promise<string[]> {
  const acl = new Set<string>();

  // Get document owner from database (primary) or Qdrant (fallback)
  const doc = await db.query.document.findFirst({
    where: eq(documentTable.id, documentId),
    columns: { userId: true },
  });

  if (doc?.userId) {
    acl.add(doc.userId);
  } else {
    // Fallback to Qdrant for documents that exist only in vector store
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const client = new QdrantClient({ url: qdrantUrl });
    try {
      const ownerCheck = await client.scroll('documents', {
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
        limit: 1,
        with_payload: true,
        with_vector: false,
      });
      const points = ownerCheck.points as { payload?: Record<string, unknown> }[];
      if (points.length > 0) {
        const ownerId = points[0].payload?.userId as string | undefined;
        if (ownerId) acl.add(ownerId);
      }
    } catch {
      // Qdrant unavailable; continue with DB-only ACL
    }
  }

  // Get all permissions for this document
  const perms = await db.query.documentPermission.findMany({
    where: eq(documentPermission.documentId, documentId),
  });

  for (const perm of perms) {
    if (perm.userId) {
      acl.add(perm.userId);
    }
    if (perm.groupId) {
      // Add all members of this group
      const members = await db.query.groupMember.findMany({
        where: eq(groupMember.groupId, perm.groupId),
      });
      for (const member of members) {
        acl.add(member.userId);
      }
    }
  }

  return Array.from(acl);
}

/**
 * Updates the ACL on all Qdrant points for a document.
 * Re-scans permissions and re-upserts the accessControlList payload field.
 */
export async function updateDocumentAcl(documentId: string): Promise<void> {
  const acl = await buildDocumentAcl(documentId);
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const client = new QdrantClient({ url: qdrantUrl });

  try {
    // Scroll all points for this document
    const allPoints = await client.scroll('documents', {
      filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      limit: 10000,
      with_payload: true,
      with_vector: false,
    });

    const points = allPoints.points as {
      id: string;
      payload?: Record<string, unknown>;
    }[];

    if (points.length === 0) return;

    // Update payload on each point using setPayload
    for (const point of points) {
      await client.setPayload('documents', {
        points: [point.id],
        payload: {
          accessControlList: acl,
        },
      });
    }

    logger.info({ documentId, aclLength: acl.length, pointCount: points.length }, 'Document ACL updated');
  } catch (error) {
    logger.warn({ err: error, documentId }, 'Failed to update ACL in Qdrant');
  }
}

// ---------------------------------------------------------------------------
// API Route Handlers
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;
  const { id: documentId } = await params;

  try {
    // Verify document belongs to user's org (prevent cross-org access)
    const docCheck = await db.query.document.findFirst({
      where: and(eq(documentTable.id, documentId), eq(documentTable.orgId, orgId)),
      columns: { id: true },
    });
    if (!docCheck) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify requester has admin or owner permission
    const userPerm = await resolveUserPermission(documentId, userId);
    if (!userPerm || userPerm === 'read' || userPerm === 'write') {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      );
    }

    // Fetch all permissions for this document
    const perms = await db.query.documentPermission.findMany({
      where: eq(documentPermission.documentId, documentId),
    });

    // Enrich with user/group details via manual lookups
    const result = await Promise.all(
      perms.map(async (perm) => {
        let userInfo = null;
        let groupInfo = null;

        if (perm.userId) {
          const u = await db.query.user.findFirst({
            where: eq(userTable.id, perm.userId),
            columns: { id: true, name: true, email: true },
          });
          userInfo = u;
        }

        if (perm.groupId) {
          const g = await db.query.groupTable.findFirst({
            where: eq(groupTable.id, perm.groupId),
            columns: { id: true, name: true, description: true },
          });
          groupInfo = g;
        }

        return {
          id: perm.id,
          permission: perm.permission,
          grantedBy: perm.grantedBy,
          createdAt: perm.createdAt,
          type: perm.userId ? 'user' : 'group',
          user: userInfo,
          group: groupInfo,
        };
      })
    );

    // Also include the owner (check DB first, then Qdrant)
    let ownerInfo = null;
    const doc = await db.query.document.findFirst({
      where: eq(documentTable.id, documentId),
      columns: { userId: true },
    });

    if (doc?.userId) {
      const owner = await db.query.user.findFirst({
        where: eq(userTable.id, doc.userId),
        columns: { id: true, name: true, email: true },
      });
      if (owner) {
        ownerInfo = { ...owner, type: 'owner' as const };
      }
    } else {
      // Fallback to Qdrant for documents that exist only in vector store
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const client = new QdrantClient({ url: qdrantUrl });
      try {
        const ownerCheck = await client.scroll('documents', {
          filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
          limit: 1,
          with_payload: true,
          with_vector: false,
        });
        const points = ownerCheck.points as { payload?: Record<string, unknown> }[];
        if (points.length > 0) {
          const ownerId = points[0].payload?.userId as string;
          const owner = await db.query.user.findFirst({
            where: eq(userTable.id, ownerId),
            columns: { id: true, name: true, email: true },
          });
          if (owner) {
            ownerInfo = { ...owner, type: 'owner' as const };
          }
        }
      } catch {
        // Qdrant unavailable
      }
    }

    return NextResponse.json({ permissions: result, owner: ownerInfo });
  } catch (error) {
    logger.error({ err: error, documentId }, 'Failed to list permissions');
    return NextResponse.json(
      { error: 'Failed to list permissions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;
  const { id: documentId } = await params;

  try {
    const body = await request.json();
    const { targetUserId, targetGroupId, permission } = body as {
      targetUserId?: string;
      targetGroupId?: string;
      permission: 'read' | 'write' | 'admin';
    };

    if (!targetUserId && !targetGroupId) {
      return NextResponse.json(
        { error: 'Either targetUserId or targetGroupId is required' },
        { status: 400 }
      );
    }

    if (permission && !['read', 'write', 'admin'].includes(permission)) {
      return NextResponse.json(
        { error: 'Permission must be read, write, or admin' },
        { status: 400 }
      );
    }

    // Verify document belongs to user's org (prevent cross-org permission changes)
    const docCheck = await db.query.document.findFirst({
      where: and(eq(documentTable.id, documentId), eq(documentTable.orgId, orgId)),
      columns: { id: true },
    });
    if (!docCheck) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify grantor has admin or owner permission
    const userPerm = await resolveUserPermission(documentId, userId);
    if (!userPerm || userPerm === 'read' || userPerm === 'write') {
      return NextResponse.json(
        { error: 'Admin permission required to grant access' },
        { status: 403 }
      );
    }

    // Verify target is in the same org (prevent cross-org sharing)
    if (targetUserId) {
      const targetUser = await db.query.user.findFirst({
        where: eq(userTable.id, targetUserId),
        columns: { orgId: true, email: true },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      if (targetUser.orgId !== orgId) {
        return NextResponse.json(
          { error: 'Cannot share with users outside your organization' },
          { status: 400 }
        );
      }
    }

    if (targetGroupId) {
      const group = await db.query.groupTable.findFirst({
        where: eq(groupTable.id, targetGroupId),
        columns: { orgId: true, name: true },
      });
      if (!group) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }
      if (group.orgId !== orgId) {
        return NextResponse.json(
          { error: 'Cannot share with groups outside your organization' },
          { status: 400 }
        );
      }
    }

    // Create permission record
    const permId = randomUUID();
    await db.insert(documentPermission).values({
      id: permId,
      documentId,
      userId: targetUserId ?? null,
      groupId: targetGroupId ?? null,
      permission,
      grantedBy: userId,
      createdAt: new Date(),
    });

    // Update ACL in Qdrant
    await updateDocumentAcl(documentId);

    const targetLabel = targetUserId ? `user:${targetUserId}` : `group:${targetGroupId}`;
    logger.info({ documentId, target: targetLabel, permission, grantor: userId }, 'Permission granted');

    await logAuditEvent(
      userId,
      'document.permission.grant',
      `document:${documentId}`,
      { target: targetLabel, permission, orgId }
    );

    return NextResponse.json({ success: true, permissionId: permId });
  } catch (error) {
    logger.error({ err: error, documentId }, 'Failed to grant permission');
    return NextResponse.json(
      { error: 'Failed to grant permission' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;
  const { id: documentId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permissionId');

    if (!permissionId) {
      return NextResponse.json(
        { error: 'permissionId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify document belongs to user's org (prevent cross-org permission revocation)
    const docCheck = await db.query.document.findFirst({
      where: and(eq(documentTable.id, documentId), eq(documentTable.orgId, orgId)),
      columns: { id: true },
    });
    if (!docCheck) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify requester has admin or owner permission
    const userPerm = await resolveUserPermission(documentId, userId);
    if (!userPerm || userPerm === 'read' || userPerm === 'write') {
      return NextResponse.json(
        { error: 'Admin permission required to revoke access' },
        { status: 403 }
      );
    }

    // Find and delete the permission record
    const perm = await db.query.documentPermission.findFirst({
      where: and(
        eq(documentPermission.documentId, documentId),
        eq(documentPermission.id, permissionId)
      ),
    });

    if (!perm) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    await db.delete(documentPermission).where(
      and(
        eq(documentPermission.documentId, documentId),
        eq(documentPermission.id, permissionId)
      )
    );

    // Update ACL in Qdrant
    await updateDocumentAcl(documentId);

    logger.info({ documentId, permissionId, revoker: userId }, 'Permission revoked');

    await logAuditEvent(
      userId,
      'document.permission.revoke',
      `document:${documentId}`,
      { permissionId, orgId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, documentId }, 'Failed to revoke permission');
    return NextResponse.json(
      { error: 'Failed to revoke permission' },
      { status: 500 }
    );
  }
}
