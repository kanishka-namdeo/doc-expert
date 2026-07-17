import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { collection, collectionDocument, document } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/collections/[id]/documents');

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id: collectionId } = await params;

    // Verify collection ownership
    const colRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.id, collectionId), eq(collection.userId, userId), eq(collection.orgId, orgId)));

    if (colRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }

    const bodySchema = z.object({
      documentId: z.string().min(1),
    });
    const parsed = bodySchema.parse(await request.json());
    const { documentId } = parsed;

    // Verify document belongs to user and org
    const docRows = await db
      .select()
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.userId, userId), eq(document.orgId, orgId)));

    if (docRows.length === 0) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // Check if already in collection
    const existing = await db
      .select()
      .from(collectionDocument)
      .where(and(
        eq(collectionDocument.collectionId, collectionId),
        eq(collectionDocument.documentId, documentId)
      ));

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Document already in collection' }, { status: 409 });
    }

    const joinId = randomUUID();
    await db.insert(collectionDocument).values({
      id: joinId,
      collectionId,
      documentId,
      orgId,
      createdAt: new Date(),
    });

    await logAuditEvent(
      userId,
      'collection.document.add',
      'collections',
      { collectionId, documentId, orgId }
    );

    logger.info({ collectionId, documentId }, 'Document added to collection');
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to add document to collection');
    return NextResponse.json({ error: 'Failed to add document to collection' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id: collectionId } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId query parameter is required' }, { status: 400 });
    }

    // Verify collection ownership
    const colRows = await db
      .select()
      .from(collection)
      .where(and(eq(collection.id, collectionId), eq(collection.userId, userId), eq(collection.orgId, orgId)));

    if (colRows.length === 0) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }

    await db
      .delete(collectionDocument)
      .where(and(
        eq(collectionDocument.collectionId, collectionId),
        eq(collectionDocument.documentId, documentId),
        eq(collectionDocument.orgId, orgId)
      ));

    await logAuditEvent(
      userId,
      'collection.document.remove',
      'collections',
      { collectionId, documentId, orgId }
    );

    logger.info({ collectionId, documentId }, 'Document removed from collection');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove document from collection');
    return NextResponse.json({ error: 'Failed to remove document from collection' }, { status: 500 });
  }
}
