'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { FileText, Share2, LayoutList, FileText as FileTextIcon, Globe, Search, Loader2, Brain, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DocumentShareDialog } from '@/components/document-share-dialog';
import { PageHeader } from '@/components/page-header';
import { PageLoading } from '@/components/page-loading';
import { cn } from '@/lib/utils';
import { useLogger } from '@/hooks/use-logger';
import { useOnboardingHints } from '@/hooks/use-onboarding-hints';

interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    fileName: string;
    uploadedAt: string;
    chunkIndex?: number;
  };
  score?: number;
}

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'document' | 'chunks' | 'search'>('document');
  const logger = useLogger('document-view');
  const [status, setStatus] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const { updateContext: updateHintContext } = useOnboardingHints();

  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setChunks(data.chunks || []);
        if (data.status) setStatus(data.status);
        if (data.source) setSource(data.source);
        updateHintContext({ isFirstDocumentView: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    if (documentId) {
      fetchDocument();
    }
  }, [documentId, updateHintContext]);

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setViewMode('document');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, topK: 10 }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.chunks || []);
      setViewMode('search');
    } catch (err) {
      logger.error('Semantic search error', { err: err as unknown });
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMode === 'semantic' && searchQuery.trim()) {
        handleSemanticSearch();
      }
      // Text mode filters reactively on every keystroke — Enter is a no-op
    }
  };

  const filteredChunks = searchQuery
    ? chunks.filter((chunk) =>
        chunk.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chunks;

  if (loading) {
    return <PageLoading message="Loading document..." />;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const fileName = chunks[0]?.metadata?.fileName || 'Unknown Document';

  // Concatenate chunks in chunkIndex order for document view
  const sortedChunks = [...filteredChunks].sort(
    (a, b) => (a.metadata?.chunkIndex ?? 0) - (b.metadata?.chunkIndex ?? 0)
  );
  const concatenatedText = sortedChunks.map((c) => c.text).join('\n\n');

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={fileName}
        description={`${chunks.length} chunks${status && status !== 'approved' ? ` • ${status}` : ''}${source && source !== 'upload' ? ` • ${source.replace('-', ' ')}` : ''}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareDialog(true)}
              title="Share this document"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              variant={viewMode === 'document' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('document')}
              title="View as document"
            >
              <FileTextIcon className="mr-2 h-4 w-4" />
              Document
            </Button>
            <Button
              variant={viewMode === 'chunks' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('chunks')}
              title="View as chunks"
            >
              <LayoutList className="mr-2 h-4 w-4" />
              Chunks
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSearchMode('text')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    searchMode === 'text'
                      ? 'bg-input text-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                  title="Text search — match exact words in document text"
                >
                  <Search className="h-3.5 w-3.5" />
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('semantic')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-input',
                    searchMode === 'semantic'
                      ? 'bg-input text-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                  title="Semantic search — find relevant chunks using AI embeddings (press Enter)"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Semantic
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={searchMode === 'text' ? 'Search within document...' : 'Ask a question...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-56 rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {searchMode === 'semantic' && (
                <Button
                  variant={viewMode === 'search' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleSemanticSearch}
                  disabled={searching || !searchQuery.trim()}
                  title="Find relevant chunks using AI embeddings"
                >
                  {searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="mr-2 h-4 w-4" />
                  )}
                  {searching ? 'Searching...' : 'Search'}
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Chat
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          {viewMode === 'document' ? (
            <div className="rounded-lg border bg-muted/30 p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {concatenatedText}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedChunks.map((chunk, index) => (
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
              {sortedChunks.length === 0 && (
                <div className="text-center text-muted-foreground">
                  {searchQuery ? 'No chunks match your search' : 'No chunks found'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentShareDialog
        documentId={documentId}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    </div>
  );
}
