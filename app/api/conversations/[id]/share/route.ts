import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, conversationShare, user, groupTable, groupMember } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession } from '@/lib/auth/session';
import { createNotification } from '@/lib/notifications';

const logger = getLogger('api/conversations/[id]/share');

const shareSchema = z.object({
  action: z.enum(['share', 'unshare']),
  targetUserId: z.string().optional(),
  targetGroupId: z.string().optional(),
  permission: z.enum(['read', 'write']).optional().default('read'),
}).refine(data => data.targetUserId || data.targetGroupId, {
  message: 'Either targetUserId or targetGroupId must be provided',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, targetUserId, targetGroupId, permission } = shareSchema.parse(body);

    // Verify ownership with orgId check
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'share') {
      if (targetUserId) {
        // Verify target user is in the same org (prevent cross-org sharing)
        const targetUser = await db.query.user.findFirst({
          where: eq(user.id, targetUserId),
          columns: { orgId: true },
        });
        if (!targetUser || targetUser.orgId !== orgId) {
          return NextResponse.json({ error: 'Cannot share with users outside your organization' }, { status: 400 });
        }

        // Check if already shared with this user
        const existing = await db
          .select()
          .from(conversationShare)
          .where(
            and(
              eq(conversationShare.conversationId, id),
              eq(conversationShare.userId, targetUserId)
            )
          );

        if (existing.length > 0) {
          // Update permission
          await db
            .update(conversationShare)
            .set({ permission, updatedAt: new Date() })
            .where(eq(conversationShare.id, existing[0].id));
        } else {
          await db.insert(conversationShare).values({
            id: crypto.randomUUID(),
            conversationId: id,
            userId: targetUserId,
            groupId: null,
            sharedByUserId: userId,
            permission,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        await logAuditEvent(userId, 'conversation.share', 'conversation', {
          conversationId: id,
          targetUserId,
          permission,
          orgId,
        });

        // Notify the target user that a conversation was shared with them
        try {
          await createNotification(
            targetUserId,
            'conversation_shared',
            'Conversation shared with you',
            'A user shared a conversation with you',
            { conversationId: id }
          );
        } catch (notifErr) {
          logger.warn({ err: notifErr }, 'Failed to create notification for conversation share');
        }
      } else if (targetGroupId) {
        // Verify group is in the same org
        const [targetGroup] = await db
          .select({ orgId: groupTable.orgId })
          .from(groupTable)
          .where(eq(groupTable.id, targetGroupId));

        if (!targetGroup || targetGroup.orgId !== orgId) {
          return NextResponse.json({ error: 'Cannot share with groups outside your organization' }, { status: 400 });
        }

        // Check if already shared with this group
        const existing = await db
          .select()
          .from(conversationShare)
          .where(
            and(
              eq(conversationShare.conversationId, id),
              eq(conversationShare.groupId, targetGroupId)
            )
          );

        if (existing.length > 0) {
          await db
            .update(conversationShare)
            .set({ permission, updatedAt: new Date() })
            .where(eq(conversationShare.id, existing[0].id));
        } else {
          await db.insert(conversationShare).values({
            id: crypto.randomUUID(),
            conversationId: id,
            userId: null,
            groupId: targetGroupId,
            sharedByUserId: userId,
            permission,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        await logAuditEvent(userId, 'conversation.share', 'conversation', {
          conversationId: id,
          targetGroupId,
          permission,
          orgId,
        });
      }
    } else {
      // Unshare
      if (targetUserId) {
        await db
          .delete(conversationShare)
          .where(
            and(
              eq(conversationShare.conversationId, id),
              eq(conversationShare.userId, targetUserId)
            )
          );

        await logAuditEvent(userId, 'conversation.unshare', 'conversation', {
          conversationId: id,
          targetUserId,
          orgId,
        });
      } else if (targetGroupId) {
        await db
          .delete(conversationShare)
          .where(
            and(
              eq(conversationShare.conversationId, id),
              eq(conversationShare.groupId, targetGroupId)
            )
          );

        await logAuditEvent(userId, 'conversation.unshare', 'conversation', {
          conversationId: id,
          targetGroupId,
          orgId,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to share conversation');
    return NextResponse.json({ error: 'Failed to share conversation' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;

    // Verify ownership or shared access with orgId check
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conv.userId !== userId) {
      // Check direct share
      const directShare = await db
        .select()
        .from(conversationShare)
        .where(
          and(
            eq(conversationShare.conversationId, id),
            eq(conversationShare.userId, userId)
          )
        );

      // Check group share — find groups this user is a member of
      const userGroupMemberships = await db
        .select({ groupId: groupMember.groupId })
        .from(groupMember)
        .where(eq(groupMember.userId, userId));

      let hasGroupShare = false;
      if (userGroupMemberships.length > 0) {
        const groupIds = userGroupMemberships.map(g => g.groupId);
        const groupShare = await db
          .select()
          .from(conversationShare)
          .where(
            and(
              eq(conversationShare.conversationId, id),
              inArray(conversationShare.groupId, groupIds)
            )
          );
        hasGroupShare = groupShare.length > 0;
      }

      if (directShare.length === 0 && !hasGroupShare) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get all shares for this conversation
    const shares = await db
      .select({
        id: conversationShare.id,
        userId: conversationShare.userId,
        groupId: conversationShare.groupId,
        permission: conversationShare.permission,
        createdAt: conversationShare.createdAt,
      })
      .from(conversationShare)
      .where(eq(conversationShare.conversationId, id));

    const result: Array<{
      id: string;
      userId: string | null;
      groupId: string | null;
      permission: string | null;
      createdAt: Date;
      type: 'user' | 'group';
      user: { id: string; email: string; name: string | null } | { email: string; name: null } | null;
      group: { id: string; name: string; description: string | null; memberCount: number } | { name: string; description: null; memberCount: number } | null;
    }> = [];

    for (const share of shares) {
      if (share.userId) {
        // User share
        const userData = await db
          .select({ id: user.id, email: user.email, name: user.name })
          .from(user)
          .where(eq(user.id, share.userId));

        result.push({
          ...share,
          type: 'user' as const,
          user: userData[0] || { email: 'Unknown', name: null },
          group: null,
        });
      } else if (share.groupId) {
        // Group share
        const groupData = await db
          .select({
            id: groupTable.id,
            name: groupTable.name,
            description: groupTable.description,
          })
          .from(groupTable)
          .where(eq(groupTable.id, share.groupId));

        // Count members
        const [memberCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(groupMember)
          .where(eq(groupMember.groupId, share.groupId));

        result.push({
          ...share,
          type: 'group' as const,
          user: null,
          group: groupData[0]
            ? { ...groupData[0], memberCount: memberCount?.count || 0 }
            : { name: 'Unknown', description: null, memberCount: 0 },
        });
      }
    }

    return NextResponse.json({ shares: result });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get conversation shares');
    return NextResponse.json({ error: 'Failed to get shares' }, { status: 500 });
  }
}
