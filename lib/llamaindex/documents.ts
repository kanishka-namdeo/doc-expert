import { QdrantVectorStore } from './qdrant-store';
import { getLogger } from '@/lib/logger';
import type { DocumentInfo } from '@/lib/types/qdrant';

const logger = getLogger('llamaindex/documents');

export async function listDocuments(orgId: string, userId?: string): Promise<DocumentInfo[]> {
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  
  const vectorStore = new QdrantVectorStore({
    url: qdrantUrl,
    collectionName: 'documents',
  });

  const documents = new Map<string, DocumentInfo>();
  
  let offset: string | number | null = null;
  let hasMore = true;
  
  while (hasMore) {
    const filter: { must: Array<{ key: string; match: { value: unknown } }> } = {
      must: [
        { key: 'orgId', match: { value: orgId } },
        { key: 'status', match: { value: 'approved' } },
      ],
    };
    if (userId) {
      filter.must.push({ key: 'userId', match: { value: userId } });
    }

    const result = await vectorStore.getClient().scroll('documents', {
      limit: 100,
      with_payload: true,
      offset: offset ?? undefined,
      filter,
    });
    
    const points = result.points || [];
    
    for (const point of points) {
      const payload = point.payload as { documentId?: string; fileName?: string; uploadedAt?: string; source?: string } | undefined;
      if (!payload?.documentId || !payload?.fileName) continue;

      const docId = payload.documentId;
      if (!documents.has(docId)) {
        documents.set(docId, {
          documentId: docId,
          fileName: payload.fileName,
          uploadedAt: payload.uploadedAt || new Date().toISOString(),
          chunkCount: 0,
          source: payload.source,
        });
      }
      
      const doc = documents.get(docId)!;
      doc.chunkCount++;
    }
    
    offset = (result.next_page_offset as string | number | null) ?? null;
    hasMore = offset !== null && offset !== undefined;
  }
  
  logger.info({ documentCount: documents.size, userId }, 'Documents listed');
  
  return Array.from(documents.values());
}

export async function getDocumentsByIds(
  documentIds: string[],
  orgId: string,
  userId?: string,
): Promise<Map<string, DocumentInfo>> {
  if (documentIds.length === 0) return new Map();

  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';

  const vectorStore = new QdrantVectorStore({
    url: qdrantUrl,
    collectionName: 'documents',
  });

  const filter: Record<string, unknown> = {
    must: [
      { key: 'documentId', match: { any: documentIds } },
      { key: 'orgId', match: { value: orgId } },
      ...(userId ? [{ key: 'userId', match: { value: userId } }] : []),
    ],
  };

  const documents = new Map<string, DocumentInfo>();

  let offset: string | number | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await vectorStore.getClient().scroll('documents', {
      limit: 100,
      with_payload: true,
      offset: offset ?? undefined,
      filter,
    });

    const points = result.points || [];

    for (const point of points) {
      const payload = point.payload as {
        documentId?: string;
        fileName?: string;
        uploadedAt?: string;
      } | undefined;
      if (!payload?.documentId || !payload?.fileName) continue;

      const docId = payload.documentId;
      if (!documentIds.includes(docId)) continue;

      if (!documents.has(docId)) {
        documents.set(docId, {
          documentId: docId,
          fileName: payload.fileName,
          uploadedAt: payload.uploadedAt || new Date().toISOString(),
          chunkCount: 0,
        });
      }

      documents.get(docId)!.chunkCount++;
    }

    offset = (result.next_page_offset as string | number | null) ?? null;
    hasMore = offset !== null && offset !== undefined;
  }

  logger.info(
    { requestedIds: documentIds.length, found: documents.size, userId },
    'Documents fetched by IDs',
  );

  return documents;
}

export async function deleteDocument(documentId: string, orgId: string): Promise<{ deletedCount: number; fileName: string }> {
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  
  const vectorStore = new QdrantVectorStore({
    url: qdrantUrl,
    collectionName: 'documents',
  });
  
  // First, query to get the fileName
  const scrollResult = await vectorStore.getClient().scroll('documents', {
    filter: {
      must: [
        { key: 'documentId', match: { value: documentId } },
        { key: 'orgId', match: { value: orgId } },
      ],
    },
    with_payload: true,
    with_vector: false,
    limit: 1,
  });
  
  const points = scrollResult.points || [];
  const fileName = (points[0]?.payload as { fileName?: string })?.fileName || 'Unknown';

  // Delete all points with this documentId
  const deleteResult = await vectorStore.getClient().delete('documents', {
    filter: {
      must: [{ key: 'documentId', match: { value: documentId } }],
    },
  });

  logger.info({ documentId, deletedCount: points.length, fileName }, 'Document deleted');

  return { deletedCount: points.length, fileName };
}
