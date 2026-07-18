import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/lib/llamaindex/documents';
import { getLogger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { document as documentTable, documentPermission } from '@/lib/db/schema';
import { eq, and, inArray, like } from 'drizzle-orm';

const logger = getLogger('api/documents');

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { userId, orgId } = session;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'owned' | 'shared-with-me' | 'shared-by-me' | 'pending'
    const source = searchParams.get('source'); // 'upload' | 'google-drive' | 'microsoft-365'
    const q = searchParams.get('q'); // Search query for filename

    let documents: Array<{
      documentId: string;
      fileName: string;
      uploadedAt: string;
      chunkCount: number;
      accessLevel?: string;
      sharedWithCount?: number;
      status?: string;
      source?: string;
    }>;

    try {
      // Build source filter condition
      const sourceFilter = source && source !== 'all' ? eq(documentTable.source, source) : undefined;

      if (filter === 'shared-with-me') {
        // Get document IDs where user has explicit permission (not owner)
        const perms = await db.query.documentPermission.findMany({
          where: eq(documentPermission.userId, userId),
          columns: { documentId: true, permission: true },
        });
        const permDocIds = [...new Set(perms.map((p) => p.documentId))];

        if (permDocIds.length === 0) {
          documents = [];
        } else {
          // Query SQLite for all documents with status
          const whereConditions = [
            inArray(documentTable.id, permDocIds),
            ...(sourceFilter ? [sourceFilter] : []),
          ];
          const dbDocs = await db.query.document.findMany({
            columns: { id: true, fileName: true, createdAt: true, status: true, source: true },
            where: whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions),
          });
          documents = dbDocs.map((d) => ({
            documentId: d.id,
            fileName: d.fileName,
            uploadedAt: new Date(d.createdAt).toISOString(),
            chunkCount: 0,
            accessLevel: perms.find((p) => p.documentId === d.id)?.permission || 'read',
            status: d.status || 'pending',
            source: d.source || 'upload',
          }));

          // Merge chunk counts from Qdrant (only approved docs have Qdrant entries)
          const qdrantDocs = await listDocuments(orgId);
          for (const qd of qdrantDocs) {
            const doc = documents.find((d) => d.documentId === qd.documentId);
            if (doc) doc.chunkCount = qd.chunkCount;
          }
        }
      } else if (filter === 'shared-by-me') {
        // Get documents owned by user that have permissions granted by this user
        const perms = await db.query.documentPermission.findMany({
          where: eq(documentPermission.grantedBy, userId),
          columns: { documentId: true },
        });
        const grantedDocIds = [...new Set(perms.map((p) => p.documentId))];

        if (grantedDocIds.length === 0) {
          documents = [];
        } else {
          // Query SQLite for owned documents with status
          const whereConditions = [
            eq(documentTable.userId, userId),
            inArray(documentTable.id, grantedDocIds),
            ...(sourceFilter ? [sourceFilter] : []),
          ];
          const dbDocs = await db.query.document.findMany({
            columns: { id: true, fileName: true, createdAt: true, status: true, source: true },
            where: whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions),
          });

          // Count how many users each document was shared with
          const shareCounts = await db.query.documentPermission.findMany({
            where: and(
              eq(documentPermission.grantedBy, userId),
              inArray(documentPermission.documentId, grantedDocIds)
            ),
            columns: { documentId: true },
          });

          const countMap = new Map<string, number>();
          for (const sc of shareCounts) {
            countMap.set(sc.documentId, (countMap.get(sc.documentId) || 0) + 1);
          }

          documents = dbDocs.map((d) => ({
            documentId: d.id,
            fileName: d.fileName,
            uploadedAt: new Date(d.createdAt).toISOString(),
            chunkCount: 0,
            accessLevel: 'owner',
            sharedWithCount: countMap.get(d.id) || 0,
            status: d.status || 'pending',
            source: d.source || 'upload',
          }));

          // Merge chunk counts from Qdrant
          const qdrantDocs = await listDocuments(orgId, userId);
          for (const qd of qdrantDocs) {
            const doc = documents.find((d) => d.documentId === qd.documentId);
            if (doc) doc.chunkCount = qd.chunkCount;
          }
        }
      } else if (filter === 'pending') {
        // Show owned documents with pending status
        const whereConditions = [
          eq(documentTable.userId, userId),
          eq(documentTable.status, 'pending'),
          ...(sourceFilter ? [sourceFilter] : []),
        ];
        const dbDocs = await db.query.document.findMany({
          columns: { id: true, fileName: true, createdAt: true, status: true, source: true },
          where: whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions),
        });

        documents = dbDocs.map((d) => ({
          documentId: d.id,
          fileName: d.fileName,
          uploadedAt: new Date(d.createdAt).toISOString(),
          chunkCount: 0,
          accessLevel: 'owner',
          status: d.status || 'pending',
          source: d.source || 'upload',
        }));
      } else {
        // Default: owned by me — query SQLite for all owned documents
        const whereConditions = [
          eq(documentTable.userId, userId),
          ...(sourceFilter ? [sourceFilter] : []),
          ...(q ? [like(documentTable.fileName, `%${q}%`)] : []),
        ];
        const dbDocs = await db.query.document.findMany({
          columns: { id: true, fileName: true, createdAt: true, status: true, source: true, mediaType: true, fileSize: true },
          where: whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions),
        });

        documents = dbDocs.map((d) => ({
          documentId: d.id,
          fileName: d.fileName,
          uploadedAt: new Date(d.createdAt).toISOString(),
          chunkCount: 0,
          accessLevel: 'owner',
          status: d.status || 'pending',
          source: d.source || 'upload',
        }));

        // Merge chunk counts from Qdrant (only approved docs have entries)
        const qdrantDocs = await listDocuments(orgId, userId);
        for (const qd of qdrantDocs) {
          const doc = documents.find((d) => d.documentId === qd.documentId);
          if (doc) doc.chunkCount = qd.chunkCount;
        }
      }

      // Sort by upload date, most recent first
      documents.sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (err) {
      // If everything fails, return empty list instead of 500
      logger.warn({ err }, 'Document listing failed, returning empty list');
      documents = [];
    }

    logger.info({ documentCount: documents.length, filter }, 'Documents listed successfully');

    if (session.session) {
      await logAuditEvent(
        session.session.user.id,
        'document.list',
        'documents',
        { documentCount: documents.length, orgId, filter }
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
