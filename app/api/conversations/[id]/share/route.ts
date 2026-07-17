import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { conversation, conversationShare, user } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/conversations/[id]/share');

const shareSchema = z.object({
  action: z.enum(['share', 'unshare']),
  targetUserId: z.string(),
  permission: z.enum(['read', 'write']).optional().default('read'),
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
    const { action, targetUserId, permission } = shareSchema.parse(body);

    // Verify ownership with orgId check
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify target user is in the same org (prevent cross-org sharing)
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, targetUserId),
      columns: { orgId: true },
    });
    if (!targetUser || targetUser.orgId !== orgId) {
      return NextResponse.json({ error: 'Cannot share with users outside your organization' }, { status: 400 });
    }

    if (action === 'share') {
      // Check if already shared
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
          .set({ permission, updatedAt: new Date() as any })
          .where(eq(conversationShare.id, existing[0].id));
      } else {
        await db.insert(conversationShare).values({
          id: crypto.randomUUID(),
          conversationId: id,
          userId: targetUserId,
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
    } else {
      // Unshare
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
      const share = await db
        .select()
        .from(conversationShare)
        .where(
          and(
            eq(conversationShare.conversationId, id),
            eq(conversationShare.userId, userId)
          )
        );
      if (share.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get all shares for this conversation
    const shares = await db
      .select({
        id: conversationShare.id,
        userId: conversationShare.userId,
        permission: conversationShare.permission,
        createdAt: conversationShare.createdAt,
      })
      .from(conversationShare)
      .where(eq(conversationShare.conversationId, id));

    // Get user details
    const userIds = shares.map((s) => s.userId);
    const users = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(inArray(user.id, userIds));

    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      shares: shares.map((s) => ({
        ...s,
        user: userMap.get(s.userId) || { email: 'Unknown', name: null },
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get conversation shares');
    return NextResponse.json({ error: 'Failed to get shares' }, { status: 500 });
  }
}
