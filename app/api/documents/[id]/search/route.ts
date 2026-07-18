import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';
import { embed } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { QdrantVectorStore } from '@/lib/llamaindex/qdrant-store';
import retry from 'async-retry';

const logger = getLogger('api/documents/[id]/search');

const ollama = createOllama({ baseURL: (process.env.OLLAMA_URL ?? 'http://localhost:11434') + '/api' });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id: documentId } = await params;
    const body = await request.json();
    const { query, topK = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (topK < 1 || topK > 20) {
      return NextResponse.json(
        { error: 'topK must be between 1 and 20' },
        { status: 400 }
      );
    }

    logger.info({ documentId, queryLength: query.length, topK, userId }, 'Semantic search started');

    const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
    const vectorStore = new QdrantVectorStore({
      url: qdrantUrl,
      collectionName: 'documents',
    });

    // Embed the query
    const { embedding: queryEmbedding } = await embed({
      model: ollama.embedding(process.env.EMBED_MODEL ?? 'dengcao/Qwen3-Embedding-0.6B:Q8_0'),
      value: query,
    });

    // Search within the specific document
    const filter = {
      must: [
        { key: 'documentId', match: { value: documentId } },
        { key: 'orgId', match: { value: orgId } },
        { key: 'status', match: { value: 'approved' } },
      ],
    };

    const searchResults = await retry(
      async () => {
        return await vectorStore.getClient().search('documents', {
          vector: queryEmbedding,
          limit: topK,
          with_payload: true,
          filter,
        });
      },
      {
        retries: 3,
        minTimeout: 500,
        maxTimeout: 5000,
        factor: 2,
        onRetry: (err: unknown, attempt: number) => {
          logger.warn({ err, attempt, documentId, queryLength: query.length }, 'Retrying semantic search');
        },
      }
    );

    // Transform results
    const chunks = searchResults
      .filter((point) => {
        const score = point.score;
        return typeof score === 'number' && score >= 0.1;
      })
      .map((point) => {
        const payload = point.payload as Record<string, unknown>;
        return {
          id: point.id as string,
          text: (payload?.text as string) ?? '',
          score: point.score as number,
          metadata: {
            fileName: (payload?.fileName as string) ?? 'Unknown',
            uploadedAt: (payload?.uploadedAt as string) ?? '',
            chunkIndex: (payload?.chunkIndex as number) ?? 0,
          },
        };
      });

    logger.info(
      { documentId, queryLength: query.length, resultCount: chunks.length, userId },
      'Semantic search complete'
    );

    return NextResponse.json({ chunks });
  } catch (error) {
    logger.error({ err: error, documentId: (await params).id }, 'Semantic search failed');
    return NextResponse.json(
      { error: 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}
