import { generateText } from 'ai';
import { getLogger } from '@/lib/logger';
import { getLLMAsync } from '@/lib/ai/provider';

const logger = getLogger('llamaindex/query-planner');

export interface QueryPlan {
  queries: string[];
  searchMode: 'broad' | 'narrow';
  followUpQueries?: string[];
}

const FALLBACK_PLAN: QueryPlan = {
  queries: [],
  searchMode: 'narrow',
};

const SYSTEM_PROMPT = `You are a query planner for a document retrieval system. Your job is to decompose a user's question into multiple search queries that, together, will find the most relevant document chunks.

Given the user's query and optional conversation history, output ONLY valid JSON in this exact format:
{
  "queries": ["query variant 1", "query variant 2", "query variant 3", "query variant 4"],
  "searchMode": "broad" | "narrow",
  "followUpQueries": ["follow-up 1", "follow-up 2"]
}

Rules for query generation:
- Include the original query as the first element
- Add 1-2 decomposed sub-questions that break the query into simpler parts
- Add 1-2 synonym-expanded or rephrased variants
- Optionally add a HyDE-style hypothetical answer (a short statement of what an answer might look like)
- Keep each query under 100 characters

Rules for searchMode:
- "broad" when the query is exploratory, vague, or covers multiple topics
- "narrow" when the query is specific and focused

Rules for followUpQueries:
- Suggest 2-3 natural follow-up questions the user might ask next
- Keep each under 60 characters

Output ONLY the JSON object. No markdown. No explanation. No wrapping code blocks.`;

export async function planQuery(
  query: string,
  history: string[] = []
): Promise<QueryPlan> {
  const historyContext = history.length > 0
    ? `\nRecent conversation history:\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  const userPrompt = `User query: ${query}${historyContext}\n\nGenerate the search query plan.`;

  try {
    const llm = await getLLMAsync();
    const { text } = await generateText({
      model: llm,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
    const parsed = JSON.parse(cleaned) as QueryPlan;

    if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) {
      logger.warn({ parsed }, 'Query plan returned empty queries array');
      return { ...FALLBACK_PLAN, queries: [query] };
    }

    if (parsed.searchMode !== 'broad' && parsed.searchMode !== 'narrow') {
      logger.warn({ searchMode: parsed.searchMode }, 'Query plan returned invalid searchMode');
      parsed.searchMode = 'narrow';
    }

    logger.info({
      queryLength: query.length,
      queryCount: parsed.queries.length,
      searchMode: parsed.searchMode,
      hasFollowUps: !!parsed.followUpQueries,
    }, 'Query plan generated');

    return parsed;
  } catch (error) {
    logger.warn({ err: error, queryLength: query.length }, 'Query planning failed, using fallback');
    return { ...FALLBACK_PLAN, queries: [query] };
  }
}
