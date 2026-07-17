import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/conversations/[id]');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;

    // Get conversation — scoped by userId AND orgId
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(message.createdAt);

    return NextResponse.json({ conversation: conv, messages });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get conversation');
    return NextResponse.json({ error: 'Failed to get conversation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;

    // Verify ownership with orgId check
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete messages first
    await db.delete(message).where(eq(message.conversationId, id));

    // Delete conversation
    await db.delete(conversation).where(and(eq(conversation.id, id), eq(conversation.orgId, orgId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete conversation');
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;
    const body = await request.json();
    const { title } = body;

    // Verify ownership
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update conversation
    await db
      .update(conversation)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(conversation.id, id), eq(conversation.orgId, orgId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update conversation');
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
