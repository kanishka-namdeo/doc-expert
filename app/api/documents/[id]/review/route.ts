import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { document, user as userTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { QdrantVectorStore } from '@/lib/llamaindex/qdrant-store';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/documents/[id]/review');

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication and admin role
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = reviewSchema.parse(body);

    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.orgId, orgId)));

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db
      .update(document)
      .set({
        status: newStatus,
        reviewedBy: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(document.id, id));

    // Sync status change to Qdrant so retrieval filters work correctly
    try {
      const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
      const vectorStore = new QdrantVectorStore({
        url: qdrantUrl,
        collectionName: 'documents',
      });

      await vectorStore.getClient().setPayload('documents', {
        payload: { status: newStatus },
        filter: {
          must: [
            { key: 'documentId', match: { value: id } },
            { key: 'orgId', match: { value: orgId } },
          ],
        },
      });

      logger.info({ documentId: id, newStatus }, 'Qdrant status updated');
    } catch (qdrantError) {
      logger.warn({ err: qdrantError, documentId: id }, 'Failed to update Qdrant status, but SQLite updated successfully');
    }

    await logAuditEvent(
      userId,
      `document.${action}`,
      'document',
      { documentId: id, fileName: doc.fileName, orgId }
    );

    return NextResponse.json({ success: true, status: action });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to review document');
    return NextResponse.json({ error: 'Failed to review document' }, { status: 500 });
  }
}
