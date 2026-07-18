import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument } from '@/lib/llamaindex/documents';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { user as userTable, document as documentTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/documents/[id]');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id: documentId } = await params;
    const { userId, orgId } = session;

    // Use scroll API to get all points with matching documentId
    const response = await fetch(
      `${process.env.QDRANT_URL || 'http://localhost:6333'}/collections/documents/points/scroll`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: 'documentId',
                match: { value: documentId },
              },
              {
                key: 'userId',
                match: { value: userId },
              },
              {
                key: 'orgId',
                match: { value: orgId },
              },
            ],
          },
          with_payload: true,
          with_vector: false,
          limit: 1000,
        }),
      }
    );

    let chunks: { id: string; text: string; metadata: { fileName: string; uploadedAt: string; chunkIndex?: number } }[] = [];

    if (response.ok) {
      const data = await response.json();
      const points = data.result?.points || [];

      // Transform points to chunks format
      chunks = points.map((point: { id: string; payload?: Record<string, unknown> }) => ({
        id: point.id,
        text: point.payload?.text as string || '',
        metadata: {
          fileName: point.payload?.fileName as string || 'Unknown',
          uploadedAt: point.payload?.uploadedAt as string || '',
          chunkIndex: point.payload?.chunkIndex as number | undefined,
        },
      }));

      // Sort by chunk index if available
      chunks.sort((a: { metadata: { chunkIndex?: number } }, b: { metadata: { chunkIndex?: number } }) => {
        const indexA = a.metadata.chunkIndex ?? 0;
        const indexB = b.metadata.chunkIndex ?? 0;
        return indexA - indexB;
      });
    }

    // Fetch document metadata from SQLite (works for pending docs too)
    let documentStatus = 'approved';
    let documentSource = 'upload';
    let dbFileName: string | undefined;
    let dbUploadedAt: string | undefined;

    try {
      const dbDoc = await db.query.document.findFirst({
        columns: { status: true, source: true, fileName: true, createdAt: true },
        where: eq(documentTable.id, documentId),
      });
      if (dbDoc) {
        documentStatus = dbDoc.status || documentStatus;
        documentSource = dbDoc.source || documentSource;
        dbFileName = dbDoc.fileName;
        dbUploadedAt = dbDoc.createdAt ? new Date(dbDoc.createdAt).toISOString() : undefined;
      }
    } catch {
      // ignore
    }

    // If Qdrant returned empty (pending doc), populate metadata from SQLite
    if (chunks.length === 0 && dbFileName) {
      chunks = [{
        id: documentId,
        text: '',
        metadata: {
          fileName: dbFileName,
          uploadedAt: dbUploadedAt || '',
        },
      }];
    }

    logger.info({ documentId, chunkCount: chunks.length }, 'Document chunks fetched');

    await logAuditEvent(
      userId,
      'document.view',
      `document:${documentId}`,
      { chunkCount: chunks.length, orgId }
    );

    return NextResponse.json({ chunks, status: documentStatus, source: documentSource });
  } catch (error) {
    logger.error({ err: error, documentId: (await params).id }, 'Failed to fetch document chunks');
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id: documentId } = await params;

    // Check if user is admin
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
    });
    const isAdmin = user?.role === 'admin';

    // Check if user owns the document
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${qdrantUrl}/collections/documents/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'documentId', match: { value: documentId } },
            { key: 'userId', match: { value: userId } },
            { key: 'orgId', match: { value: orgId } },
          ],
        },
        with_payload: true,
        with_vector: false,
        limit: 1,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to query Qdrant');
    }

    const data = await response.json();
    const points = data.result?.points || [];
    const isOwner = points.length > 0;

    // Authorization: must be admin or document owner
    if (!isAdmin && !isOwner) {
      logger.warn({ documentId, userId, orgId }, 'Unauthorized delete attempt');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await deleteDocument(documentId, orgId);

    // Log audit event
    await logAuditEvent(
      userId,
      'document.delete',
      `file:${result.fileName}`,
      { documentId, deletedCount: result.deletedCount, orgId }
    );

    logger.info({ documentId, fileName: result.fileName, userId }, 'Document deleted');
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error, documentId: (await params).id }, 'Failed to delete document');
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}