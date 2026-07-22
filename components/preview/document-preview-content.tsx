'use client';

import { useState, useEffect } from 'react';
import { FileText, Calendar, HardDrive } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';

interface DocumentPreview {
  id: string;
  fileName: string;
  mediaType: string;
  fileSize: number;
  source: string;
  createdAt: string;
}

interface DocumentPreviewContentProps {
  documentId: string;
}

export function DocumentPreviewContent({ documentId }: DocumentPreviewContentProps) {
  const logger = useLogger('document-preview');
  const [doc, setDoc] = useState<DocumentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/${documentId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setDoc(data);
        } else {
          setError(true);
        }
      } catch (err) {
        logger.error('Failed to fetch document preview', { err, documentId });
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDocument();
  }, [documentId, logger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-xs text-destructive">Failed to load preview</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{doc.fileName}</div>
          <div className="text-xs text-muted-foreground">{doc.mediaType}</div>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>{formatFileSize(doc.fileSize)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="capitalize">{doc.source}</span>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 10) / 10} ${sizes[i]}`;
}
