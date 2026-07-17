import { QdrantClient } from '@qdrant/js-client-rest';

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    });
  }
  return client;
}

export async function ensureCollection(collectionName = 'documents') {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === collectionName);
  
  if (!exists) {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 1024, // dengcao/Qwen3-Embedding-0.6B dimension
        distance: 'Cosine',
      },
    });
  }
}
