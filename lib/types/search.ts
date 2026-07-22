export interface SearchResult {
  id: string;
  type: 'document' | 'conversation' | 'collection' | 'message';
  title: string;
  excerpt?: string;
  metadata: {
    createdAt: string;
    updatedAt?: string;
    chunkCount?: number;
    messageCount?: number;
    documentCount?: number;
    source?: string;
    similarity?: number;
  };
}

export interface SearchResponse {
  documents: SearchResult[];
  conversations: SearchResult[];
  collections: SearchResult[];
  messages: SearchResult[];
}
