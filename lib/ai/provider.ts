import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import { db } from '@/lib/db';
import { systemConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * LLM Provider Abstraction
 *
 * Single source of truth for model configuration.
 * Supports Ollama (local) and StreamLake (Tencent Cloud API Gateway).
 */

const ollama = createOllama({
  baseURL: (process.env.OLLAMA_URL ?? 'http://localhost:11434') + '/api',
});

/**
 * StreamLake API Gateway Provider
 *
 * Tencent Cloud StreamLake custom endpoint (Action-based protocol).
 * Requires API key and proper request signing.
 */
const streamlake = createOpenAI({
  baseURL: process.env.STREAMLAKE_BASE_URL ?? 'https://vanchin.streamlake.ai/api/gateway/coding/v1',
  apiKey: process.env.STREAMLAKE_API_KEY ?? '',
});

// Static model list since /models endpoint is not OpenAI-compatible
export const STREAMLAKE_MODELS = [
  'kat-coder-pro-v2.5',
] as const;

export type StreamLakeModelId = typeof STREAMLAKE_MODELS[number];

/**
 * Get the default model ID from system config (with env fallback).
 */
export async function getDefaultModel(): Promise<string> {
  try {
    const row = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'default_model'),
    });
    if (row?.value) return row.value;
  } catch {
    // Fall through to env var
  }
  return process.env.LLM_MODEL ?? 'llama3.1:8b';
}

/**
 * Get the appropriate LLM based on model ID.
 * Falls back to the configured default model when no modelId is provided.
 */
export async function getLLMAsync(modelId?: string) {
  const resolvedModel = modelId ?? (await getDefaultModel());
  if (modelId && STREAMLAKE_MODELS.includes(modelId as StreamLakeModelId)) {
    return streamlake.chat(modelId);
  }
  if (STREAMLAKE_MODELS.includes(resolvedModel as StreamLakeModelId)) {
    return streamlake.chat(resolvedModel as StreamLakeModelId);
  }
  return ollama(resolvedModel);
}

export function getLLM(modelId?: string) {
  if (modelId && STREAMLAKE_MODELS.includes(modelId as StreamLakeModelId)) {
    return streamlake.chat(modelId);
  }
  return ollama(process.env.LLM_MODEL ?? 'llama3.1:8b');
}

export const llm = getLLM();

export const embedModel = ollama.embeddingModel(
  process.env.EMBED_MODEL ?? 'dengcao/Qwen3-Embedding-0.6B:Q8_0'
);
