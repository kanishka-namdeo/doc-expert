import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/account/import');

const importSchema = z.object({
  version: z.number(),
  conversations: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      createdAt: z.union([z.number(), z.string()]),
      updatedAt: z.union([z.number(), z.string()]),
      messages: z.array(
        z.object({
          id: z.string(),
          role: z.string(),
          content: z.string(),
          metadata: z.string().nullable(),
          createdAt: z.union([z.number(), z.string()]),
        })
      ),
    })
  ),
});

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { userId, orgId } = session;
    const body = await request.json();
    const data = importSchema.parse(body);

    let imported = 0;
    let skipped = 0;

    for (const conv of data.conversations) {
      // Check if conversation already exists
      const existing = await db
        .select({ id: conversation.id })
        .from(conversation)
        .where(eq(conversation.id, conv.id))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const createdAt = new Date(conv.createdAt);
      const updatedAt = new Date(conv.updatedAt);

      await db.insert(conversation).values({
        id: conv.id,
        userId,
        orgId,
        title: conv.title,
        createdAt,
        updatedAt,
      });

      for (const msg of conv.messages) {
        await db.insert(message).values({
          id: msg.id,
          conversationId: conv.id,
          orgId,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          createdAt: new Date(msg.createdAt),
        });
      }

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: data.conversations.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid import data', details: (error as z.ZodError).issues[0].message },
        { status: 400 }
      );
    }
    logger.error({ err: error }, 'Import failed');
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
