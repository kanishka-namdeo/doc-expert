'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    fileName: string;
    uploadedAt: string;
    chunkIndex?: number;
  };
}

export default function DocumentViewerPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setChunks(data.chunks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const filteredChunks = searchQuery
    ? chunks.filter((chunk) =>
        chunk.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chunks;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading document...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const fileName = chunks[0]?.metadata?.fileName || 'Unknown Document';

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{fileName}</h1>
            <p className="text-sm text-muted-foreground">
              {chunks.length} chunks • Uploaded{' '}
              {chunks[0]?.metadata?.uploadedAt
                ? new Date(chunks[0].metadata.uploadedAt).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-primary hover:underline"
          >
            ← Back to Chat
          </a>
        </div>
      </header>

      <div className="border-b p-4">
        <input
          type="text"
          placeholder="Search within document..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {filteredChunks.map((chunk, index) => (
            <div
              key={chunk.id}
              className="rounded-lg border bg-muted/30 p-4"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Chunk {chunk.metadata?.chunkIndex ?? index + 1}</span>
              </div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose prose-sm dark:prose-invert max-w-none"
              >
                {chunk.text}
              </ReactMarkdown>
            </div>
          ))}
          {filteredChunks.length === 0 && (
            <div className="text-center text-muted-foreground">
              {searchQuery ? 'No chunks match your search' : 'No chunks found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
