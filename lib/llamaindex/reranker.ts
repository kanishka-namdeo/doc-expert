import { generateText } from 'ai';
import { getLogger } from '@/lib/logger';
import { getLLMAsync } from '@/lib/ai/provider';
import type { CandidateChunk } from '@/lib/types/qdrant';

const logger = getLogger('llamaindex/reranker');

const RERANK_THRESHOLD = 0.3;
const RERANK_MIN_RESULTS = 5;
const RERANK_MAX_RESULTS = 8;
const RERANK_MODEL = process.env.RERANK_MODEL || undefined;
const MAX_CANDIDATES = 30;

interface LLMRerankResult {
  index: number;
  score: number;
}

const SYSTEM_PROMPT = `You are a relevance judge for a document retrieval system. Your job is to score how relevant each document chunk is to a given query.

Given a query and a list of document chunks, output ONLY valid JSON in this exact format:
[{"index": 0, "score": 0.85}, {"index": 1, "score": 0.12}, ...]

Rules:
- "index" is the 0-based position of the chunk in the input list
- "score" is a relevance score from 0.0 (completely irrelevant) to 1.0 (perfectly relevant)
- Score based on whether the chunk contains information useful for answering the query
- Be strict: most irrelevant chunks should score below 0.3
- Include ALL chunks in the output, even those with score 0.0

Output ONLY the JSON array. No markdown. No explanation. No wrapping code blocks.`;

function buildUserPrompt(query: string, candidates: CandidateChunk[]): string {
  const chunksText = candidates
    .map((c, i) => `[${i}] (file: ${c.fileName}) ${c.text.slice(0, 500)}`)
    .join('\n\n');

  return `Query: ${query}\n\nDocument chunks:\n${chunksText}\n\nScore each chunk's relevance to the query.`;
}

export async function rerankCandidates(
  query: string,
  candidates: CandidateChunk[]
): Promise<CandidateChunk[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= RERANK_MIN_RESULTS) {
    return candidates.sort((a, b) => b.score - a.score);
  }

  const inputCandidates = candidates.slice(0, MAX_CANDIDATES);

  try {
    const llm = await getLLMAsync(RERANK_MODEL);
    const { text } = await generateText({
      model: llm,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(query, inputCandidates),
      temperature: 0,
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
    const parsed = JSON.parse(cleaned) as LLMRerankResult[];

    if (!Array.isArray(parsed)) {
      logger.warn({ parsed }, 'Reranker returned non-array result');
      return fallbackRank(query, inputCandidates);
    }

    // Map scores back to candidates
    const scored = parsed
      .map((result) => {
        if (typeof result.index !== 'number' || typeof result.score !== 'number') return null;
        const candidate = inputCandidates[result.index];
        if (!candidate) return null;
        return { ...candidate, score: Math.max(0, Math.min(1, result.score)) };
      })
      .filter((c): c is CandidateChunk => c !== null);

    const passed = scored.filter(c => c.score >= RERANK_THRESHOLD);
    if (passed.length === 0) {
      logger.info({ candidateCount: candidates.length }, 'No candidates passed rerank threshold');
      return [];
    }

    const ranked = passed.sort((a, b) => b.score - a.score).slice(0, RERANK_MAX_RESULTS);

    logger.info({
      inputCount: inputCandidates.length,
      scoredCount: scored.length,
      passedCount: passed.length,
      topScore: ranked[0]?.score,
    }, 'Reranking complete');

    return ranked;
  } catch (error) {
    logger.warn({ err: error, candidateCount: candidates.length }, 'Reranking failed, using fallback');
    return fallbackRank(query, inputCandidates);
  }
}

function fallbackRank(query: string, candidates: CandidateChunk[]): CandidateChunk[] {
  // Fall back to dense-score ordering, apply a simple threshold
  return candidates
    .filter(c => c.score >= RERANK_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, RERANK_MAX_RESULTS);
}
