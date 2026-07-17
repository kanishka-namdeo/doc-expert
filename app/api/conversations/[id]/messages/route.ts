import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/conversations/[id]/messages');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;

    // Verify ownership
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get messages with pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(message.createdAt)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ messages });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get messages');
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;
    const body = await request.json();
    const { role, content, metadata } = body;

    // Verify ownership
    const [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.id, id), eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Add message
    const newMessage = await db
      .insert(message)
      .values({
        id: crypto.randomUUID(),
        conversationId: id,
        orgId,
        role,
        content: JSON.stringify(content),
        createdAt: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();

    // Update conversation updatedAt
    await db
      .update(conversation)
      .set({ updatedAt: new Date() })
      .where(and(eq(conversation.id, id), eq(conversation.orgId, orgId)));

    return NextResponse.json({ message: newMessage[0] }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Failed to add message');
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
