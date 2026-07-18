import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { collection, collectionDocument } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, desc, count, and } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/collections');

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const cols: Array<{ id: string; name: string; description: string | null; docCount: number }> = [];

    const rows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.userId, userId), eq(collection.orgId, orgId)))
      .orderBy(desc(collection.updatedAt));

    for (const row of rows) {
      const [{ count: docCount }] = await db
        .select({ count: count() })
        .from(collectionDocument)
        .where(and(eq(collectionDocument.collectionId, row.id), eq(collectionDocument.orgId, orgId)));

      cols.push({
        id: row.id,
        name: row.name,
        description: row.description,
        docCount: docCount ?? 0,
      });
    }

    return NextResponse.json({ collections: cols });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list collections');
    return NextResponse.json({ error: 'Failed to list collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    });
    const parsed = bodySchema.parse(await request.json());
    const { name, description } = parsed;

    const id = randomUUID();
    const now = new Date();

    await db.insert(collection).values({
      id,
      userId,
      orgId,
      name,
      description: description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(
      userId,
      'collection.create',
      'collections',
      { collectionId: id, name, orgId }
    );

    logger.info({ collectionId: id, name }, 'Collection created');
    return NextResponse.json({ id, name, description, docCount: 0 }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to create collection');
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}
