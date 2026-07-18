import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, conversationShare } from '@/lib/db/schema';
import { eq, desc, or, sql, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession, orgRequiredResponse } from '@/lib/auth/session';

const logger = getLogger('api/conversations');

export async function GET(request: Request) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { userId, orgId } = session;

    // Get owned conversations
    const owned = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.userId, userId), eq(conversation.orgId, orgId)))
      .orderBy(desc(conversation.updatedAt));

    // Get shared conversations (shared with this user) - scoped by orgId
    const shared = await db
      .select({
        conversation: conversation,
        permission: conversationShare.permission,
      })
      .from(conversationShare)
      .innerJoin(conversation, eq(conversationShare.conversationId, conversation.id))
      .where(and(eq(conversationShare.userId, userId), eq(conversation.orgId, orgId)))
      .orderBy(desc(conversation.updatedAt));

    // Merge, avoiding duplicates
    const ownedIds = new Set(owned.map((c) => c.id));
    const sharedConvs = shared
      .filter((s) => !ownedIds.has(s.conversation.id))
      .map((s) => ({
        ...s.conversation,
        shared: true,
        permission: s.permission,
      }));

    const allConversations = [...owned, ...sharedConvs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ conversations: allConversations });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list conversations');
    return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const body = await request.json();
    const { title, collectionId } = body;
    const { userId, orgId } = session;

    const now = new Date();
    const newConversation = await db
      .insert(conversation)
      .values({
        id: crypto.randomUUID(),
        userId,
        orgId,
        title: title || 'New Conversation',
        collectionId: collectionId || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ conversation: newConversation[0] }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create conversation');
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
