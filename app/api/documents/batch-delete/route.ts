import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument } from '@/lib/llamaindex/documents';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/documents/batch-delete');

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const body = await request.json();
    const { documentIds } = body as { documentIds: string[] };

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (documentIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot delete more than 100 documents at once' },
        { status: 400 }
      );
    }

    // Check if user is admin
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
    });
    const isAdmin = user?.role === 'admin';

    // Verify ownership for each document
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${qdrantUrl}/collections/documents/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'documentId', match: { any: documentIds } },
            { key: 'userId', match: { value: userId } },
            { key: 'orgId', match: { value: orgId } },
          ],
        },
        with_payload: true,
        with_vector: false,
        limit: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to query Qdrant');
    }

    const data = await response.json();
    const points = data.result?.points || [];
    
    // Extract unique documentIds that user owns
    const ownedDocumentIds = new Set(
      points.map((p: { payload?: Record<string, unknown> }) => p.payload?.documentId as string)
    );

    // Filter to only documents user can delete
    const deletableIds = documentIds.filter(id => isAdmin || ownedDocumentIds.has(id));

    if (deletableIds.length === 0) {
      return NextResponse.json(
        { error: 'No documents can be deleted (not owned or forbidden)' },
        { status: 403 }
      );
    }

    // Delete each document
    const results = await Promise.allSettled(
      deletableIds.map(id => deleteDocument(id, orgId))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    // Log audit event
    await logAuditEvent(
      userId,
      'document.batch_delete',
      `documents:${deletableIds.length}`,
      { documentIds: deletableIds, successful, failed, orgId }
    );

    logger.info(
      { documentIds: deletableIds, successful, failed, userId },
      'Batch delete completed'
    );

    return NextResponse.json({
      success: true,
      requested: documentIds.length,
      deletable: deletableIds.length,
      successful,
      failed,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to batch delete documents');
    return NextResponse.json(
      { error: 'Failed to delete documents' },
      { status: 500 }
    );
  }
}
