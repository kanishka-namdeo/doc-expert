import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { collection, collectionDocument, document } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/collections/[id]');

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;

    // Verify ownership with orgId
    const colRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.id, id), eq(collection.userId, userId), eq(collection.orgId, orgId)));

    if (colRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }
    const col = colRows[0];

    // Get documents in this collection
    const docRows = await db
      .select({
        id: document.id,
        fileName: document.fileName,
        mediaType: document.mediaType,
        fileSize: document.fileSize,
        status: document.status,
        createdAt: document.createdAt,
      })
      .from(collectionDocument)
      .innerJoin(document, eq(document.id, collectionDocument.documentId))
      .where(and(
        eq(collectionDocument.collectionId, id),
        eq(collectionDocument.orgId, orgId)
      ))
      .orderBy(desc(collectionDocument.createdAt));

    return NextResponse.json({
      collection: {
        id: col.id,
        name: col.name,
        description: col.description,
        documents: docRows,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get collection');
    return NextResponse.json({ error: 'Failed to get collection' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;

    // Verify ownership
    const colRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.id, id), eq(collection.userId, userId), eq(collection.orgId, orgId)));

    if (colRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    });
    const parsed = bodySchema.parse(await request.json());

    const updates: Record<string, unknown> = {};
    if (parsed.name !== undefined) updates.name = parsed.name;
    if (parsed.description !== undefined) updates.description = parsed.description;

    await db
      .update(collection)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(collection.id, id), eq(collection.orgId, orgId)));

    await logAuditEvent(
      userId,
      'collection.update',
      'collections',
      { collectionId: id, orgId }
    );

    logger.info({ collectionId: id }, 'Collection updated');
    return NextResponse.json({ ...colRows[0], ...updates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to update collection');
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;

    // Verify ownership
    const colRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.id, id), eq(collection.userId, userId), eq(collection.orgId, orgId)));

    if (colRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }

    // Delete join records (not the documents themselves)
    await db.delete(collectionDocument).where(and(eq(collectionDocument.collectionId, id), eq(collectionDocument.orgId, orgId)));
    await db.delete(collection).where(and(eq(collection.id, id), eq(collection.orgId, orgId)));

    await logAuditEvent(
      userId,
      'collection.delete',
      'collections',
      { collectionId: id, orgId }
    );

    logger.info({ collectionId: id }, 'Collection deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete collection');
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
  }
}
