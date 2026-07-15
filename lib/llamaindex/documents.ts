import { getVectorStore } from './config';

export interface DocumentInfo {
  documentId: string;
  fileName: string;
  uploadedAt: string;
  chunkCount: number;
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const vectorStore = getVectorStore();
  
  // Query Qdrant for all points to get unique documents
  // We'll need to scroll through all points to collect unique document IDs
  const documents = new Map<string, DocumentInfo>();
  
  let offset = null;
  let hasMore = true;
  
  while (hasMore) {
    const response: Response = await fetch(`${process.env.QDRANT_URL || 'http://localhost:6333'}/collections/documents/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        offset,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to query documents from Qdrant');
    }

    const data: { result?: { points: Array<{ payload?: { documentId?: string; fileName?: string; uploadedAt?: string } }>; next_page_offset?: string | null } } = await response.json();
    const points = data.result?.points || [];
    
    for (const point of points) {
      const payload = point.payload;
      if (!payload?.documentId || !payload?.fileName) continue;
      
      const docId = payload.documentId;
      if (!documents.has(docId)) {
        documents.set(docId, {
          documentId: docId,
          fileName: payload.fileName,
          uploadedAt: payload.uploadedAt || new Date().toISOString(),
          chunkCount: 0,
        });
      }
      
      const doc = documents.get(docId)!;
      doc.chunkCount++;
    }
    
    offset = data.result?.next_page_offset;
    hasMore = offset !== null && offset !== undefined;
  }
  
  return Array.from(documents.values());
}
