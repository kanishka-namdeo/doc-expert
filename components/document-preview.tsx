'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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

interface DocumentPreviewProps {
  documentId: string | null;
  onOpenChange: (documentId: string | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500 text-yellow-50',
  approved: 'bg-green-500 text-green-50',
  rejected: 'bg-red-500 text-red-50',
};

export function DocumentPreview({
  documentId,
  onOpenChange,
}: DocumentPreviewProps) {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [status, setStatus] = useState<string>('pending');
  const [source, setSource] = useState<string>('upload');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    async function fetchDocument() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document preview');
        }
        const data = await response.json();
        setChunks(data.chunks || []);
        if (data.status) setStatus(data.status);
        if (data.source) setSource(data.source);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [documentId]);

  const sortedChunks = [...chunks].sort(
    (a, b) => (a.metadata?.chunkIndex ?? 0) - (b.metadata?.chunkIndex ?? 0)
  );
  const fileName = chunks[0]?.metadata?.fileName || 'Loading...';
  const uploadedAt = chunks[0]?.metadata?.uploadedAt || '';
  const concatenatedText = sortedChunks.map((c) => c.text).join('\n\n');

  return (
    <Dialog open={!!documentId} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
          {status && (
            <Badge className={STATUS_COLORS[status] || STATUS_COLORS.pending}>
              {status}
            </Badge>
          )}
          {uploadedAt && <span>{new Date(uploadedAt).toLocaleDateString()}</span>}
          <span>{chunks.length} chunks</span>
          {source && source !== 'upload' && (
            <span>• {source.replace(/-/g, ' ')}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading preview...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-sm text-destructive">
              {error}
            </div>
          ) : chunks.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No content available yet. Document has not been processed.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {concatenatedText}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
