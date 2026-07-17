import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message, user } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/account/export');

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { userId, orgId } = session;

    // Get user data
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    // Get conversations with messages (org-scoped)
    const convs = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.userId, userId), eq(conversation.orgId, orgId)));

    const exportData: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      orgId,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        createdAt: userData.createdAt,
      },
      conversations: [],
    };

    for (const conv of convs) {
      const msgs = await db
        .select()
        .from(message)
        .where(eq(message.conversationId, conv.id))
        .orderBy(message.createdAt);

      (exportData.conversations as unknown[]).push({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.createdAt,
        })),
      });
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="doc-expert-export.json"',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Export failed');
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
