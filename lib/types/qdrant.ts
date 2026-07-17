export interface QdrantPointPayload {
  text: string;
  documentId: string;
  fileName: string;
  uploadedAt: string;
  userId: string;
  chunkIndex: number;
  source?: string; // 'upload' | 'google-drive' | 'microsoft-365'
  /** Node ID of the parent chunk (set on child points only) */
  parentId?: string;
  /** True if this point is a parent chunk (no parent of its own) */
  isParent?: boolean;
  /** Index among siblings sharing the same parent (0-based) */
  siblingIndex?: number;
}

export interface Source {
  text: string;
  fileName: string;
  score: number;
  nodeId: string;
}

export interface DocumentInfo {
  documentId: string;
  fileName: string;
  uploadedAt: string;
  chunkCount: number;
  source?: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    fileName: string;
    uploadedAt: string;
    chunkIndex: number;
  };
}

/**
 * A candidate chunk returned from retrieval stages.
 * Carries the payload fields needed for scoring, reranking, and context assembly.
 */
export interface CandidateChunk {
  id: string;
  text: string;
  fileName: string;
  uploadedAt: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  score: number;
  parentId?: string;
  isParent?: boolean;
  siblingIndex?: number;
}
