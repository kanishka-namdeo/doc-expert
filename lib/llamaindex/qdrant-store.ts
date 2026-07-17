import { QdrantClient } from '@qdrant/js-client-rest';
import type { BaseNode, Metadata, TextNode } from 'llamaindex';
import { getLogger } from '@/lib/logger';
import retry from 'async-retry';

const logger = getLogger('llamaindex/qdrant-store');

export interface QdrantVectorStoreOptions {
  url: string;
  collectionName: string;
}

export class QdrantVectorStore {
  private client: QdrantClient;
  public collectionName: string;

  constructor(options: QdrantVectorStoreOptions) {
    this.client = new QdrantClient({ url: options.url });
    this.collectionName = options.collectionName;
  }

  // Expose underlying client for direct operations
  getClient(): QdrantClient {
    return this.client;
  }

  // Required by VectorStoreIndex - add nodes to vector store
  async add(nodes: BaseNode[], embeddings: number[][]): Promise<string[]> {
    if (nodes.length === 0) {
      return [];
    }

    const points = nodes.map((node, idx) => {
      const embedding = embeddings[idx];
      if (!embedding || embedding.length === 0) {
        throw new Error(`Node ${idx} has no embedding`);
      }

      const metadata = node.metadata as Record<string, unknown>;
      const text = (node as TextNode).getText() ?? '';

      return {
        id: node.id_,
        vector: embedding,
        payload: {
          ...metadata,
          text,
          nodeId: node.id_,
        },
      };
    });

    await retry(
      async () => {
        await this.client.upsert(this.collectionName, {
          wait: true,
          points,
        });
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2,
        onRetry: (err, attempt) => {
          logger.warn({ err, attempt, pointCount: points.length }, 'Retrying upsert');
        },
      }
    );

    logger.info({ pointCount: points.length, collectionName: this.collectionName }, 'Points upserted to Qdrant');

    return nodes.map((n) => n.id_);
  }

  // Delete by document ID filter
  async delete(refDocId: string): Promise<void> {
    await retry(
      async () => {
        await this.client.delete(this.collectionName, {
          filter: {
            must: [{ key: 'documentId', match: { value: refDocId } }],
          },
        });
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2,
        onRetry: (err, attempt) => {
          logger.warn({ err, attempt, refDocId }, 'Retrying delete');
        },
      }
    );

    logger.info({ refDocId, collectionName: this.collectionName }, 'Document deleted from Qdrant');
  }

  // Ensure collection exists with correct dimensions
  async ensureCollection(vectorSize: number): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const existingCollection = collections.collections.find((c) => c.name === this.collectionName);

      if (existingCollection) {
        // Need to fetch full collection info to get config
        try {
          const collectionInfo = await this.client.getCollection(this.collectionName);
          const actualSize = collectionInfo.config?.params?.vectors?.size;
          if (actualSize !== vectorSize) {
            logger.error({ expected: vectorSize, actual: actualSize }, 'Collection dimension mismatch');
            throw new Error(
              `Qdrant collection '${this.collectionName}' has wrong dimension: ${actualSize}. Expected ${vectorSize}.`
            );
          }
          logger.info({ collectionName: this.collectionName, vectorSize: actualSize }, 'Collection exists with correct dimensions');
        } catch (getErr) {
          logger.error({ err: getErr, collectionName: this.collectionName }, 'Failed to get collection info');
          throw getErr;
        }
      } else {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        });
        logger.info({ collectionName: this.collectionName, vectorSize }, 'Collection created');
      }
    } catch (err) {
      logger.error({ err, collectionName: this.collectionName }, 'ensureCollection failed');
      throw err;
    }
  }
}
