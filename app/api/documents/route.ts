import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/lib/llamaindex/documents';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession, orgRequiredResponse } from '@/lib/auth/session';

const logger = getLogger('api/documents');

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { userId, orgId } = session;

    let documents: Array<{ documentId: string; fileName: string; uploadedAt: string; chunkCount: number }>;

    try {
      documents = await listDocuments(orgId, userId);
      // Sort by upload date, most recent first
      documents.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (qdrantError) {
      // Qdrant unavailable — return empty list instead of 500
      logger.warn({ err: qdrantError }, 'Qdrant unavailable, returning empty document list');
      documents = [];
    }

    logger.info({ documentCount: documents.length }, 'Documents listed successfully');

    if (session.session) {
      await logAuditEvent(
        session.session.user.id,
        'document.list',
        'documents',
        { documentCount: documents.length, orgId }
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list documents');
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}
