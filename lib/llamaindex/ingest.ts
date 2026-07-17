import { SentenceSplitter, TextNode } from 'llamaindex';
import { embed } from 'ai';
import { randomUUID } from 'node:crypto';
import { getLogger } from '@/lib/logger';
import { embedModel } from '@/lib/ai/provider';
import { QdrantVectorStore } from './qdrant-store';

import { PdfBufferReader } from './loaders/pdf-loader';
import { DocxBufferReader } from './loaders/docx-loader';
import { MarkdownBufferReader } from './loaders/markdown-loader';
import type { QdrantPointPayload } from '@/lib/types/qdrant';
import retry from 'async-retry';

const logger = getLogger('llamaindex/ingest');
const BATCH_SIZE = 100;

const PARENT_CHUNK_SIZE = parseInt(process.env.PARENT_CHUNK_SIZE ?? '1024', 10);
const CHILD_CHUNK_SIZE = parseInt(process.env.CHILD_CHUNK_SIZE ?? '256', 10);
const CHILD_CHUNK_OVERLAP = parseInt(process.env.CHILD_CHUNK_OVERLAP ?? '32', 10);

export interface IngestProgress {
  step: string;
  progress: number;
  message: string;
}

export class DocumentParseError extends Error {
  constructor(fileName: string, cause?: unknown) {
    super(`Failed to parse document: ${fileName}`, { cause });
    this.name = 'DocumentParseError';
  }
}

function getReaderForMimeType(mimeType: string) {
  switch (mimeType) {
    case 'application/pdf':
      return new PdfBufferReader();
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return new DocxBufferReader();
    case 'text/markdown':
      return new MarkdownBufferReader();
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

export interface IngestBufferOptions {
  userId: string;
  orgId: string;
  fileName: string;
  mimeType: string;
  collectionId?: string;
  existingDocumentId?: string;
  metadata?: Record<string, unknown>;
}

export async function ingestBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  userId: string,
  orgId: string,
  metadata?: Record<string, unknown>,
  onProgress?: (progress: IngestProgress) => void,
  existingDocumentId?: string,
): Promise<{ documentId: string; chunkCount: number }> {
  const documentId = existingDocumentId ?? randomUUID();

  try {
    // Stage 1: Parse document (10%)
    onProgress?.({ step: 'parse', progress: 10, message: 'Reading document...' });
    logger.info({ fileName, fileType: mimeType, bufferSize: buffer.length }, 'Starting document parse');

    const reader = getReaderForMimeType(mimeType);
    logger.info({ readerType: reader.constructor.name }, 'Got reader for MIME type');

    let documents;
    if ('loadDataFromBuffer' in reader) {
      try {
        documents = await (reader as { loadDataFromBuffer: (buffer: Buffer, fileName: string) => Promise<unknown[]> }).loadDataFromBuffer(buffer, fileName);
        logger.info({ docCount: documents.length }, 'Documents loaded from buffer');
      } catch (parseErr) {
        logger.error({ err: parseErr, fileName }, 'Failed to load documents from buffer');
        throw parseErr;
      }
    } else {
      throw new Error('Reader does not support buffer input');
    }

    if (documents.length === 0) {
      throw new DocumentParseError(fileName, new Error('No content extracted'));
    }

    // Add metadata to all documents
    for (const doc of documents) {
      if (doc && typeof doc === 'object' && 'metadata' in doc) {
        const currentMetadata = typeof doc.metadata === 'object' && doc.metadata !== null
          ? doc.metadata as Record<string, unknown>
          : {};
        doc.metadata = {
          ...currentMetadata,
          documentId,
          fileName,
          uploadedAt: new Date().toISOString(),
          userId,
          orgId,
          ...metadata,
        };
      }
    }

    logger.info({ documentCount: documents.length, documentId }, 'Documents parsed');

    // Stage 2: Split into parent and child chunks (30%)
    onProgress?.({ step: 'split', progress: 30, message: 'Splitting into chunks...' });

    const parentSplitter = new SentenceSplitter({
      chunkSize: PARENT_CHUNK_SIZE,
      chunkOverlap: 0,
    });
    const childSplitter = new SentenceSplitter({
      chunkSize: CHILD_CHUNK_SIZE,
      chunkOverlap: CHILD_CHUNK_OVERLAP,
    });

    let nodes: TextNode[] = [];
    try {
      for (const doc of documents) {
        if (!doc || typeof doc !== 'object') continue;

        // First split into parent chunks
        const parentNodes = parentSplitter.getNodesFromDocuments([doc as Parameters<typeof parentSplitter.getNodesFromDocuments>[0][number]]);

        for (const parentNode of parentNodes) {
          // Generate a stable ID for the parent
          const parentId = randomUUID();

          // Build parent node with metadata
          const parentNodeWithMeta = parentNode as TextNode;
          if (parentNodeWithMeta && typeof parentNodeWithMeta === 'object' && 'metadata' in parentNodeWithMeta) {
            parentNodeWithMeta.id_ = parentId;
            parentNodeWithMeta.metadata = {
              ...parentNodeWithMeta.metadata,
              isParent: true,
            };
          }
          nodes.push(parentNodeWithMeta);

          // Then split each parent into child chunks
          const childNodes = childSplitter.getNodesFromDocuments([parentNode as Parameters<typeof childSplitter.getNodesFromDocuments>[0][number]]);

          for (let idx = 0; idx < childNodes.length; idx++) {
            const childNode = childNodes[idx] as TextNode;
            if (childNode && typeof childNode === 'object' && 'metadata' in childNode) {
              const childId = randomUUID();
              childNode.id_ = childId;
              childNode.metadata = {
                ...childNode.metadata,
                parentId,
                isParent: false,
                siblingIndex: idx,
              };
            }
            nodes.push(childNode);
          }
        }
      }

      // Assign chunkIndex to all nodes
      nodes = nodes.map((node, idx) => {
        if (node && typeof node === 'object' && 'metadata' in node) {
          node.metadata = {
            ...node.metadata,
            chunkIndex: idx,
          };
        }
        return node;
      });
    } catch (splitErr) {
      logger.error({ err: splitErr, documentCount: documents.length }, 'Failed to split documents');
      throw splitErr;
    }

    const parentCount = nodes.filter(n => (n.metadata as Record<string, unknown>).isParent === true).length;
    const childCount = nodes.length - parentCount;
    logger.info({ nodeCount: nodes.length, parentCount, childCount, documentId }, 'Document split into parent-child chunks');

    // Stage 3: Embed and upsert to Qdrant (60%)
    onProgress?.({ step: 'embed', progress: 60, message: 'Generating embeddings...' });

    const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
    const collectionName = 'documents';

    let vectorStore;
    try {
      vectorStore = new QdrantVectorStore({
        url: qdrantUrl,
        collectionName,
      });
      logger.info({ qdrantUrl }, 'QdrantVectorStore created');
    } catch (storeErr) {
      logger.error({ err: storeErr }, 'Failed to create QdrantVectorStore');
      throw storeErr;
    }

    // Ensure collection exists with correct dimensions (Qwen3 embeddings are 1024-dim)
    try {
      await vectorStore.ensureCollection(1024);
      logger.info('Collection ensured');
    } catch (ensureErr) {
      logger.error({ err: ensureErr }, 'Failed to ensure collection');
      throw ensureErr;
    }


    // Delete existing points for this documentId (if re-uploading)
    await vectorStore.getClient().delete('documents', {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    }).catch(() => {
      // No existing points, ignore
    });

    // Tag all points with status for retrieval filtering
    for (const node of nodes) {
      if (node && typeof node === 'object' && 'metadata' in node) {
        node.metadata = {
          ...node.metadata,
          status: 'approved',
        };
      }
    }

    // Insert nodes with embeddings generated via AI SDK
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      logger.info({ batchSize: batch.length, batchIndex: i }, 'Processing batch');

      // Generate embeddings for this batch using AI SDK
      const texts = batch.map((node) => (node as TextNode).getText() ?? '');
      logger.info({ textCount: texts.length }, 'Texts extracted');

      let embeddings: number[][];
      try {
        embeddings = await Promise.all(
          texts.map(async (text, idx) => {
            try {
              const { embedding } = await embed({
                model: embedModel,
                value: text,
              });
              return embedding;
            } catch (embedErr) {
              logger.error({ err: embedErr, textIndex: idx }, 'Failed to generate embedding for text');
              throw embedErr;
            }
          })
        );
        logger.info({ embeddingCount: embeddings.length }, 'Embeddings generated');
      } catch (batchErr) {
        logger.error({ err: batchErr, batchIndex: i }, 'Failed to generate embeddings for batch');
        throw batchErr;
      }


      await retry(
        async () => {
          await vectorStore.add(batch, embeddings);
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          factor: 2,
          onRetry: (err, attempt) => {
            logger.warn({ err, attempt }, 'Retrying node insertion');
          },
        }
      );

      // Update progress for each batch
      const batchProgress = 60 + Math.round((i / nodes.length) * 30);
      onProgress?.({
        step: 'embed',
        progress: batchProgress,
        message: `Embedding chunk ${i + 1}-${Math.min(i + BATCH_SIZE, nodes.length)} of ${nodes.length}...`,
      });
    }


    const chunkCount = nodes.length;
    logger.info({ chunkCount, documentId }, 'Embedding and upsert complete');

    // Stage 4: Complete (90%)
    onProgress?.({ step: 'store', progress: 90, message: 'Storing in vector database...' });

    // Stage 5: Done (100%)
    onProgress?.({ step: 'complete', progress: 100, message: 'Upload complete!' });

    return { documentId, chunkCount };
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    // Log the full error before wrapping
    logger.error({ err: error, fileName, errType: typeof error, errString: String(error) }, 'Document processing failed with error');
    throw new DocumentParseError(fileName, error);
  }
}

export async function ingestDocument(
  file: File,
  userId: string,
  orgId: string,
  onProgress?: (progress: IngestProgress) => void,
  collectionId?: string,
  existingDocumentId?: string,
): Promise<{ documentId: string; chunkCount: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return ingestBuffer(
    buffer,
    file.type,
    file.name,
    userId,
    orgId,
    collectionId ? { collectionId } : undefined,
    onProgress,
    existingDocumentId,
  );
}
