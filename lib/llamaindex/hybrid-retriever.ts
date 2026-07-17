import { embed } from 'ai';
import { getLogger } from '@/lib/logger';
import { embedModel } from '@/lib/ai/provider';
import { QdrantVectorStore } from './qdrant-store';
import type { CandidateChunk } from '@/lib/types/qdrant';
import retry from 'async-retry';

const logger = getLogger('llamaindex/hybrid-retriever');

const HYBRID_FUSION_K = parseInt(process.env.HYBRID_FUSION_K ?? '60', 10);
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DENSE_CANDIDATE_POOL = 200;
const MIN_BM25_NONZERO = 5;

interface QdrantSearchPoint {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

function buildFilter(orgId: string, userId?: string, collectionId?: string) {
  const conditions: Array<{ key: string; match: { value: unknown } }> = [
    { key: 'orgId', match: { value: orgId } },
    { key: 'status', match: { value: 'approved' } },
  ];
  if (userId) {
    conditions.push({ key: 'userId', match: { value: userId } });
  }
  if (collectionId) {
    conditions.push({ key: 'collectionId', match: { value: collectionId } });
  }
  return conditions.length > 0 ? { must: conditions } : undefined;
}

function payloadToCandidate(point: QdrantSearchPoint): CandidateChunk {
  const payload = point.payload as Record<string, unknown>;
  return {
    id: String(point.id),
    text: String(payload.text ?? ''),
    fileName: String(payload.fileName ?? 'Unknown'),
    uploadedAt: String(payload.uploadedAt ?? ''),
    documentId: String(payload.documentId ?? ''),
    userId: String(payload.userId ?? ''),
    orgId: String(payload.orgId ?? ''),
    chunkIndex: Number(payload.chunkIndex ?? 0),
    score: point.score,
    parentId: payload.parentId ? String(payload.parentId) : undefined,
    isParent: Boolean(payload.isParent),
    siblingIndex: payload.siblingIndex !== undefined ? Number(payload.siblingIndex) : undefined,
    accessControlList: Array.isArray(payload.accessControlList) ? payload.accessControlList as string[] : undefined,
  };
}

/** Tokenize text: split on whitespace and punctuation, lowercase. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(t => t.length > 0);
}

/** BM25 scoring for a single document against a query. */
function bm25Score(
  docTokens: string[],
  queryTokens: string[],
  idf: Map<string, number>,
  avgDocLen: number,
  k1: number,
  b: number
): number {
  const docLen = docTokens.length;
  if (docLen === 0) return 0;

  const freq = new Map<string, number>();
  for (const token of docTokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const qToken of queryTokens) {
    const tf = freq.get(qToken) ?? 0;
    if (tf === 0) continue;
    const idfVal = idf.get(qToken) ?? 0;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
    score += idfVal * (numerator / denominator);
  }
  return score;
}

/** Build IDF map from a pool of documents. */
function buildIdf(docTokens: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const N = docTokens.length;

  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const token of seen) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log(1 + (N - count + 0.5) / (count + 0.5)));
  }
  return idf;
}

async function denseSearch(
  vectorStore: QdrantVectorStore,
  query: string,
  limit: number,
  filter: unknown
): Promise<CandidateChunk[]> {
  const { embedding } = await embed({
    model: embedModel,
    value: query,
  });

  const results = await retry(
    async () => {
      return await vectorStore.getClient().search('documents', {
        vector: embedding,
        limit,
        with_payload: true,
        filter: filter as unknown as Record<string, unknown>,
      }) as QdrantSearchPoint[];
    },
    {
      retries: 3,
      minTimeout: 500,
      maxTimeout: 5000,
      factor: 2,
      onRetry: (err: unknown, attempt: number) => {
        logger.warn({ err, attempt, queryLength: query.length }, 'Retrying dense search');
      },
    }
  );

  return results
    .filter(p => typeof p.score === 'number' && p.score >= 0.1)
    .map(payloadToCandidate);
}

export interface HybridRetrievalOptions {
  orgId: string;
  userId?: string;
  collectionId?: string;
}

export async function hybridRetrieve(
  queries: string[],
  topK: number,
  options: HybridRetrievalOptions
): Promise<CandidateChunk[]> {
  const { orgId, userId, collectionId } = options;
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const vectorStore = new QdrantVectorStore({ url: qdrantUrl, collectionName: 'documents' });
  const filter = buildFilter(orgId, userId, collectionId);

  // --- Dense search: embed each query, merge by highest score ---
  const denseResults = new Map<string, CandidateChunk>();

  await Promise.all(
    queries.map(async (q) => {
      const candidates = await denseSearch(vectorStore, q, DENSE_CANDIDATE_POOL, filter);
      for (const c of candidates) {
        const existing = denseResults.get(c.id);
        if (!existing || c.score > existing.score) {
          denseResults.set(c.id, c);
        }
      }
    })
  );

  const allDense = Array.from(denseResults.values()).sort((a, b) => b.score - a.score);
  logger.info({ queryCount: queries.length, denseCount: allDense.length }, 'Dense search complete');

  if (allDense.length === 0) {
    return [];
  }

  // --- BM25 sparse search over the dense candidate pool ---
  const bm25Pool = allDense.slice(0, DENSE_CANDIDATE_POOL);
  const allQueryTokens = queries.flatMap(q => tokenize(q));
  const docTokens = bm25Pool.map(c => tokenize(c.text));
  const idf = buildIdf(docTokens);
  const avgDocLen = docTokens.reduce((sum, t) => sum + t.length, 0) / docTokens.length;

  const bm25Scores = bm25Pool.map((c, i) => ({
    candidate: c,
    bm25: bm25Score(docTokens[i], allQueryTokens, idf, avgDocLen, BM25_K1, BM25_B),
  }));

  const nonzeroBm25 = bm25Scores.filter(s => s.bm25 > 0);
  if (nonzeroBm25.length < MIN_BM25_NONZERO) {
    logger.info({ nonzeroCount: nonzeroBm25.length }, 'Too few BM25 matches, returning dense-only results');
    return allDense.slice(0, topK * 3);
  }

  // --- Reciprocal Rank Fusion ---
  const denseRank = new Map<string, number>();
  allDense.forEach((c, i) => denseRank.set(c.id, i + 1));

  const sparseRank = new Map<string, number>();
  bm25Scores
    .filter(s => s.bm25 > 0)
    .sort((a, b) => b.bm25 - a.bm25)
    .forEach((s, i) => sparseRank.set(s.candidate.id, i + 1));

  const fusedScores = new Map<string, number>();
  const allIds = new Set([...denseRank.keys(), ...sparseRank.keys()]);

  for (const id of allIds) {
    const dRank = denseRank.get(id) ?? Infinity;
    const sRank = sparseRank.get(id) ?? Infinity;
    const dScore = dRank === Infinity ? 0 : 1 / (HYBRID_FUSION_K + dRank);
    const sScore = sRank === Infinity ? 0 : 1 / (HYBRID_FUSION_K + sRank);
    fusedScores.set(id, dScore + sScore);
  }

  const fused = Array.from(fusedScores.entries())
    .map(([id, score]) => {
      const candidate = allDense.find(c => c.id === id);
      if (!candidate) return null;
      return { ...candidate, score };
    })
    .filter((c): c is CandidateChunk => c !== null)
    .sort((a, b) => b.score - a.score);

  logger.info({ fusedCount: fused.length }, 'Hybrid fusion complete');
  return fused.slice(0, topK * 3);
}
