import { OllamaEmbedding, ollama } from '@llamaindex/ollama';
import { QdrantVectorStore } from '@llamaindex/qdrant';
import { Settings } from 'llamaindex';

export function getEmbedModel() {
  return new OllamaEmbedding({
    model: process.env.EMBED_MODEL ?? 'nomic-embed-text',
    config: { host: process.env.OLLAMA_URL ?? 'http://localhost:11434' },
  });
}

export function getLLM() {
  return ollama({
    model: process.env.LLM_MODEL ?? 'llama3.1:8b',
  });
}

export function getVectorStore() {
  return new QdrantVectorStore({
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    collectionName: 'documents',
  });
}

export function configureSettings() {
  Settings.llm = getLLM();
  Settings.embedModel = getEmbedModel();
}
