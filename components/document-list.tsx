'use client';

import type { DocumentInfo } from '@/lib/types/qdrant';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Trash2, File, FileSpreadsheet, FileCode, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface DocumentListProps {
  standalone?: boolean;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <File className="h-4 w-4 shrink-0 text-red-500" />;
    case 'docx':
    case 'doc':
      return <FileSpreadsheet className="h-4 w-4 shrink-0 text-blue-500" />;
    case 'md':
    case 'markdown':
    case 'txt':
      return <FileCode className="h-4 w-4 shrink-0 text-green-500" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function DocumentListContent({ standalone }: { standalone?: boolean }) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('document-list');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(!standalone);

  async function fetchDocuments() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/documents');

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      logger.error('Failed to load documents', { err: err instanceof Error ? err.message : String(err) });
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  function handleDocumentClick(documentId: string) {
    if (!standalone) setIsOpen(false);
    router.push(`/documents/${documentId}`);
  }

  async function handleDelete(documentId: string, fileName: string) {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.documentId !== documentId));
      toast.success('Document deleted');
    } catch (err) {
      logger.error('Failed to delete document', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {error}
        <Button variant="link" size="sm" className="mt-2" onClick={fetchDocuments}>
          Try again
        </Button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No documents uploaded yet
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li key={doc.documentId} className="group relative">
          <button
            onClick={() => handleDocumentClick(doc.documentId)}
            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
          >
            <div className="flex items-start gap-3">
              {getFileIcon(doc.fileName)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-sm">
                    {doc.fileName}
                  </p>
                  {doc.source && doc.source !== 'upload' && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      <Globe className="mr-1 h-3 w-3" />
                      {doc.source.replace('-', ' ')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(doc.uploadedAt)}
                </p>
              </div>
            </div>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(doc.documentId, doc.fileName);
            }}
            disabled={deletingId === doc.documentId}
          >
            {deletingId === doc.documentId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function DocumentList({ standalone }: DocumentListProps) {
  if (standalone) {
    return (
      <div className="rounded-lg border p-4">
        <DocumentListContent standalone />
      </div>
    );
  }

  return (
    <Sheet>
      <SheetTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-xs/relaxed font-medium whitespace-nowrap transition-all outline-none select-none h-6 gap-1 px-2 border-border hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30">
        <FileText className="h-4 w-4" />
        Documents
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Uploaded Documents</SheetTitle>
          <SheetDescription>
            Browse and view your uploaded documents
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          <DocumentListContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}
