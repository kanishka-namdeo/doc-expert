import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/account/import/preview');

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
    const body = await request.json();
    const data = importSchema.parse(body);

    const conversations = data.conversations;
    const total = conversations.length;

    if (total === 0) {
      return NextResponse.json({
        conversations: 0,
        dateRange: { start: null, end: null },
        conflicts: 0,
      });
    }

    // Calculate date range
    const dates = conversations.map((c) => new Date(c.createdAt).getTime());
    const start = new Date(Math.min(...dates));
    const end = new Date(Math.max(...dates));

    // Check for conflicts
    const ids = conversations.map((c) => c.id);
    const existing = await db
      .select({ id: conversation.id })
      .from(conversation)
      .where(inArray(conversation.id, ids));

    return NextResponse.json({
      conversations: total,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      conflicts: existing.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid import data', details: (error as z.ZodError).issues[0].message },
        { status: 400 }
      );
    }
    logger.error({ err: error }, 'Import preview failed');
    return NextResponse.json({ error: 'Import preview failed' }, { status: 500 });
  }
}
