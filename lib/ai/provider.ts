import { createOllama } from 'ollama-ai-provider-v2';

/**
 * LLM Provider Abstraction
 * 
 * Single source of truth for model configuration.
 * Swap Ollama → vLLM → llama.cpp without touching callers.
 */

const ollama = createOllama({
  baseURL: process.env.OLLAMA_URL ?? 'http://localhost:11434/api',
});

export const llm = ollama(process.env.LLM_MODEL ?? 'llama3.1:8b');

export const embedModel = ollama.embeddingModel(
  process.env.EMBED_MODEL ?? 'nomic-embed-text'
);
