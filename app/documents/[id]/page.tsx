'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

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
  const router = useRouter();
  const documentId = params.id as string;
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Header state (dummy values since we don't need chat functionality here)
  const [selectedModel] = useState<string>('');
  const [showUpload] = useState(false);
  const [currentConversationId] = useState<string | null>(null);
  const setCurrentConversationId = () => {};

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
      <AppHeader
        selectedModel={selectedModel}
        setSelectedModel={() => {}}
        showUpload={showUpload}
        setShowUpload={() => {}}
        currentConversationId={currentConversationId}
        setCurrentConversationId={() => {}}
        selectedCollectionId={null}
        setSelectedCollectionId={() => {}}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{fileName}</h1>
              <p className="text-sm text-muted-foreground">
                {chunks.length} chunks • Uploaded{' '}
                {chunks[0]?.metadata?.uploadedAt
                  ? new Date(chunks[0].metadata.uploadedAt).toLocaleDateString()
                  : 'Unknown'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search within document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button variant="outline" onClick={() => router.push('/')}>
                <FileText className="mr-2 h-4 w-4" />
                Back to Chat
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredChunks.map((chunk, index) => (
              <div
                key={chunk.id}
                className="rounded-lg border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Chunk {chunk.metadata?.chunkIndex ?? index + 1}</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {chunk.text}
                  </ReactMarkdown>
                </div>
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
    </div>
  );
}
