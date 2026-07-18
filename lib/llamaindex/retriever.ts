import { embed } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { getLogger } from '@/lib/logger';
import { QdrantVectorStore } from './qdrant-store';
import type { Source, CandidateChunk } from '@/lib/types/qdrant';
import retry from 'async-retry';
import { planQuery } from './query-planner';
import { hybridRetrieve } from './hybrid-retriever';
import { rerankCandidates } from './reranker';
import { assembleContext } from './context-assembler';

const logger = getLogger('llamaindex/retriever');

const RETRIEVAL_MODE = (process.env.RETRIEVAL_MODE ?? 'simple') as 'simple' | 'layered' | 'agentic';
const RETRIEVAL_TIMEOUT_MS = parseInt(process.env.RETRIEVAL_TIMEOUT_MS ?? '15000', 10);

const ollama = createOllama({ baseURL: (process.env.OLLAMA_URL ?? 'http://localhost:11434') + '/api' });

function buildFilter(orgId: string, userId?: string, collectionId?: string) {
  const filterConditions: Array<{ key: string; match: { value: unknown } }> = [
    { key: 'orgId', match: { value: orgId } },
    { key: 'status', match: { value: 'approved' } },
  ];
  if (userId) {
    filterConditions.push({ key: 'accessControlList', match: { value: userId } });
  }
  if (collectionId) {
    filterConditions.push({ key: 'collectionId', match: { value: collectionId } });
  }
  return filterConditions.length > 0 ? { must: filterConditions } : undefined;
}

async function simpleSearch(
  query: string,
  topK: number,
  orgId: string,
  userId?: string,
  collectionId?: string
): Promise<{ context: string; sources: Source[] }> {
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const vectorStore = new QdrantVectorStore({
    url: qdrantUrl,
    collectionName: 'documents',
  });

  const { embedding: queryEmbedding } = await embed({
    model: ollama.embedding(process.env.EMBED_MODEL ?? 'dengcao/Qwen3-Embedding-0.6B:Q8_0'),
    value: query,
  });

  const filter = buildFilter(orgId, userId, collectionId);

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
        logger.warn({ err, attempt, queryLength: query.length }, 'Retrying retrieval');
      },
    }
  );

  const sources: Source[] = [];
  for (const point of searchResults) {
    const score = point.score;
    if (typeof score !== 'number' || score < 0.1) continue;

    const payload = point.payload as { text?: string; fileName?: string };
    const text = payload?.text ?? '';
    const fileName = payload?.fileName || 'Unknown';

    sources.push({
      text,
      fileName,
      score,
      nodeId: point.id as string,
    });
  }

  if (sources.length === 0) {
    logger.info({ queryLength: query.length, userId }, 'No relevant documents found');
    return { context: 'No relevant documents found.', sources: [] };
  }

  const context = sources
    .map((s, idx) => `[${idx + 1}] ${s.text} — ${s.fileName}`)
    .join('\n\n');

  logger.info({ queryLength: query.length, sourceCount: sources.length, userId }, 'Simple retrieval complete');
  return { context, sources };
}

async function layeredSearch(
  query: string,
  topK: number,
  orgId: string,
  userId?: string,
  collectionId?: string
): Promise<{ context: string; sources: Source[] }> {
  const t0 = Date.now();

  // Multi-query dense → hybrid fusion
  const queries = [query];
  logger.debug({ layer: 'hybrid', queryLength: query.length }, 'Layer entry: hybrid retrieval');
  const hybridResults = await hybridRetrieve(queries, topK, { orgId, userId, collectionId });
  logger.debug({ layer: 'hybrid', duration: Date.now() - t0, resultCount: hybridResults.length }, 'Layer exit: hybrid retrieval');

  if (hybridResults.length === 0) {
    return { context: 'No relevant documents found.', sources: [] };
  }

  // Context assembly (no reranking in layered mode)
  logger.debug({ layer: 'assemble', duration: Date.now() - t0 }, 'Layer entry: context assembly');
  const assembled = await assembleContext(hybridResults.slice(0, topK * 2));
  logger.debug({ layer: 'assemble', duration: Date.now() - t0, resultCount: assembled.sources.length }, 'Layer exit: context assembly');

  return assembled;
}

async function agenticSearch(
  query: string,
  topK: number,
  orgId: string,
  userId?: string,
  collectionId?: string
): Promise<{ context: string; sources: Source[] }> {
  const t0 = Date.now();

  // Query planning
  logger.debug({ layer: 'plan', queryLength: query.length }, 'Layer entry: query planning');
  let plan;
  try {
    plan = await planQuery(query);
  } catch (error) {
    logger.warn({ err: error }, 'Query planning failed, using original query');
    plan = { queries: [query], searchMode: 'narrow' };
  }
  logger.debug({ layer: 'plan', duration: Date.now() - t0, queryCount: plan.queries.length, searchMode: plan.searchMode }, 'Layer exit: query planning');

  // Multi-query dense → hybrid fusion
  logger.debug({ layer: 'hybrid', duration: Date.now() - t0 }, 'Layer entry: hybrid retrieval');
  let hybridResults: CandidateChunk[] = [];
  try {
    hybridResults = await hybridRetrieve(plan.queries, topK, { orgId, userId, collectionId });
  } catch (error) {
    logger.warn({ err: error }, 'Hybrid retrieval failed, falling back to simple search');
  }
  logger.debug({ layer: 'hybrid', duration: Date.now() - t0, resultCount: hybridResults.length }, 'Layer exit: hybrid retrieval');

  if (hybridResults.length === 0) {
    return { context: 'No relevant documents found.', sources: [] };
  }

  // LLM reranking
  logger.debug({ layer: 'rerank', duration: Date.now() - t0, candidateCount: hybridResults.length }, 'Layer entry: reranking');
  let reranked: CandidateChunk[] = [];
  try {
    reranked = await rerankCandidates(query, hybridResults);
  } catch (error) {
    logger.warn({ err: error }, 'Reranking failed, using hybrid ordering');
    reranked = hybridResults.slice(0, topK * 2).sort((a, b) => b.score - a.score);
  }
  logger.debug({ layer: 'rerank', duration: Date.now() - t0, resultCount: reranked.length }, 'Layer exit: reranking');

  if (reranked.length === 0) {
    return { context: 'No relevant documents found.', sources: [] };
  }

  // Context assembly
  logger.debug({ layer: 'assemble', duration: Date.now() - t0 }, 'Layer entry: context assembly');
  const assembled = await assembleContext(reranked);
  logger.debug({ layer: 'assemble', duration: Date.now() - t0, resultCount: assembled.sources.length }, 'Layer exit: context assembly');

  return assembled;
}

export async function retrieveContext(
  query: string,
  topK: number = 5,
  orgId: string,
  userId?: string,
  collectionId?: string
): Promise<{ context: string; sources: Source[] }> {
  const mode = RETRIEVAL_MODE;
  logger.info({ mode, queryLength: query.length, topK, orgId, userId }, 'Retrieval started');

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Retrieval timeout after ${RETRIEVAL_TIMEOUT_MS}ms`)), RETRIEVAL_TIMEOUT_MS);
  });

  const pipelinePromise = (async () => {
    switch (mode) {
      case 'layered':
        return await layeredSearch(query, topK, orgId, userId, collectionId);
      case 'agentic':
        return await agenticSearch(query, topK, orgId, userId, collectionId);
      case 'simple':
      default:
        return await simpleSearch(query, topK, orgId, userId, collectionId);
    }
  })();

  try {
    const result = await Promise.race([pipelinePromise, timeoutPromise]);
    logger.info({ mode, queryLength: query.length, sourceCount: result.sources.length }, 'Retrieval complete');
    return result;
  } catch (error) {
    if ((error as Error).message?.includes('timeout')) {
      logger.warn({ mode, queryLength: query.length, timeoutMs: RETRIEVAL_TIMEOUT_MS }, 'Retrieval timed out, returning partial results');
      // Try to return whatever the pipeline produced so far — but since Promise.race rejects,
      // we return a safe fallback. In practice the caller should handle this gracefully.
      return { context: 'Retrieval timed out. Partial results may be unavailable.', sources: [] };
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
