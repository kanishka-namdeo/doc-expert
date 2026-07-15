import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/llamaindex/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    // Query Qdrant for all chunks with this documentId
    const vectorStore = getVectorStore();
    
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
            ],
          },
          with_payload: true,
          with_vector: false,
          limit: 1000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to query Qdrant');
    }

    const data = await response.json();
    const points = data.result?.points || [];

    // Transform points to chunks format
    const chunks = points.map((point: { id: string; payload?: Record<string, unknown> }) => ({
      id: point.id,
      text: point.payload?.text as string || '',
      metadata: {
        fileName: point.payload?.fileName as string || 'Unknown',
        uploadedAt: point.payload?.uploadedAt as string || '',
        chunkIndex: point.payload?.chunkIndex as number | undefined,
      },
    }));

    // Sort by chunk index if available
    chunks.sort((a, b) => {
      const indexA = a.metadata.chunkIndex ?? 0;
      const indexB = b.metadata.chunkIndex ?? 0;
      return indexA - indexB;
    });

    return NextResponse.json({ chunks });
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
