import { getLogger } from '@/lib/logger';
import { getQdrantClient } from './qdrant-client';
import type { CandidateChunk, Source } from '@/lib/types/qdrant';
import retry from 'async-retry';

const logger = getLogger('llamaindex/context-assembler');

interface AssembledContext {
  context: string;
  sources: Source[];
}

interface QdrantPoint {
  id: string | number;
  payload: Record<string, unknown>;
}

function payloadToCandidate(point: QdrantPoint): CandidateChunk {
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
    score: 0,
    parentId: payload.parentId ? String(payload.parentId) : undefined,
    isParent: Boolean(payload.isParent),
    siblingIndex: payload.siblingIndex !== undefined ? Number(payload.siblingIndex) : undefined,
    accessControlList: Array.isArray(payload.accessControlList) ? payload.accessControlList as string[] : undefined,
  };
}

async function lookupParent(
  parentId: string
): Promise<CandidateChunk | null> {
  try {
    const client = getQdrantClient();
    const result = await retry(
      async () => {
        return await client.retrieve('documents', {
          ids: [parentId],
          with_payload: true,
        });
      },
      {
        retries: 2,
        minTimeout: 500,
        maxTimeout: 2000,
        factor: 2,
      }
    );

    const points = ((result as { points?: QdrantPoint[] }).points ?? []) as QdrantPoint[];
    if (points.length === 0) return null;
    return payloadToCandidate(points[0]);
  } catch (error) {
    logger.warn({ err: error, parentId }, 'Failed to look up parent chunk');
    return null;
  }
}

async function lookupSiblings(
  parentId: string,
  documentId: string,
  orgId: string,
  currentSiblingIndex: number | undefined
): Promise<CandidateChunk[]> {
  if (currentSiblingIndex === undefined) return [];

  try {
    const client = getQdrantClient();
    const result = await retry(
      async () => {
        return await client.scroll('documents', {
          filter: {
            must: [
              { key: 'parentId', match: { value: parentId } },
              { key: 'documentId', match: { value: documentId } },
              { key: 'orgId', match: { value: orgId } },
              { key: 'isParent', match: { value: false } },
            ],
          },
          limit: 50,
          with_payload: true,
        });
      },
      {
        retries: 2,
        minTimeout: 500,
        maxTimeout: 2000,
        factor: 2,
      }
    );

    const points = ((result as { points?: QdrantPoint[] }).points ?? []) as QdrantPoint[];
    const siblings = points.map(payloadToCandidate);

    // Find siblings with index one before or one after
    return siblings.filter(s => {
      const idx = s.siblingIndex;
      return idx === currentSiblingIndex - 1 || idx === currentSiblingIndex + 1;
    });
  } catch (error) {
    logger.warn({ err: error, parentId }, 'Failed to look up sibling chunks');
    return [];
  }
}

/** Sort chunks by document position to preserve narrative flow. */
function orderByDocumentPosition(chunks: CandidateChunk[]): CandidateChunk[] {
  return chunks.sort((a, b) => {
    if (a.documentId !== b.documentId) {
      return a.documentId.localeCompare(b.documentId);
    }
    return a.chunkIndex - b.chunkIndex;
  });
}

export async function assembleContext(
  rankedChunks: CandidateChunk[]
): Promise<AssembledContext> {
  if (rankedChunks.length === 0) {
    return { context: 'No relevant documents found.', sources: [] };
  }

  const seenParentIds = new Set<string>();
  const parentChunks = new Map<string, CandidateChunk>();
  const siblingChunks = new Map<string, CandidateChunk>();
  const assembled: CandidateChunk[] = [];

  for (const child of rankedChunks) {
    // Always include the matched child
    assembled.push(child);

    // Look up parent if this is a child chunk
    if (child.parentId && !seenParentIds.has(child.parentId)) {
      seenParentIds.add(child.parentId);
      const parent = await lookupParent(child.parentId);
      if (parent) {
        parentChunks.set(child.parentId, parent);
        assembled.push(parent);
      }

      // Fetch adjacent siblings
      if (parent) {
        const siblings = await lookupSiblings(
          child.parentId,
          child.documentId,
          child.orgId,
          child.siblingIndex
        );
        for (const sib of siblings) {
          const key = `${sib.id}`;
          if (!siblingChunks.has(key)) {
            siblingChunks.set(key, sib);
            assembled.push(sib);
          }
        }
      }
    }
  }

  // Deduplicate by chunk ID
  const unique = new Map<string, CandidateChunk>();
  for (const chunk of assembled) {
    if (!unique.has(chunk.id)) {
      unique.set(chunk.id, chunk);
    }
  }

  const ordered = orderByDocumentPosition(Array.from(unique.values()));

  // Build sources (only the originally ranked chunks, not parents/siblings)
  const sources: Source[] = rankedChunks.map(c => ({
    text: c.text,
    fileName: c.fileName,
    score: c.score,
    nodeId: c.id,
  }));

  // Build context string
  const contextParts = ordered.map((c, idx) => `[${idx + 1}] ${c.text} — ${c.fileName}`);
  const context = contextParts.join('\n\n');

  logger.info({
    inputCount: rankedChunks.length,
    assembledCount: ordered.length,
    parentCount: parentChunks.size,
    siblingCount: siblingChunks.size,
    sourceCount: sources.length,
  }, 'Context assembled');

  return { context, sources };
}
