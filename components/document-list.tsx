'use client';

import type { DocumentInfo } from '@/lib/types/qdrant';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Trash2, File, FileSpreadsheet, FileCode, Globe, CheckSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useLogger } from '@/hooks/use-logger';
import { usePinning } from '@/hooks/use-pinning';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListEmptyState, ListErrorState } from '@/components/list-empty-state';
import { SkeletonDocumentList } from '@/components/skeleton/skeleton-document-list';

type DocumentFilter = 'owned' | 'shared-with-me' | 'shared-by-me' | 'pending';
type DocumentSource = 'upload' | 'google-drive' | 'microsoft-365';

interface DocumentListProps {
  standalone?: boolean;
  filter?: DocumentFilter;
  source?: DocumentSource;
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  enableBatchOperations?: boolean;
}

interface ExtendedDocumentInfo extends DocumentInfo {
  accessLevel?: string;
  sharedWithCount?: number;
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

function getAccessBadge(accessLevel: string | undefined) {
  if (!accessLevel || accessLevel === 'owner') return null;
  switch (accessLevel) {
    case 'admin':
      return (
        <Badge variant="destructive" className="text-[10px] h-5 px-1.5" data-testid="access-badge">
          admin
        </Badge>
      );
    case 'write':
      return (
        <Badge variant="default" className="text-[10px] h-5 px-1.5" data-testid="access-badge">
          write
        </Badge>
      );
    case 'read':
      return (
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5" data-testid="access-badge">
          read
        </Badge>
      );
    default:
      return null;
  }
}

function getStatusBadge(status: string | undefined) {
  if (!status || status === 'approved') return null;
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
          pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
          rejected
        </Badge>
      );
    default:
      return null;
  }
}

function DocumentRow({
  doc,
  pinned,
  enableBatchOperations,
  batchSelectedIds,
  deletingId,
  onDocumentClick,
  onToggleBatch,
  onTogglePin,
  onDelete,
}: {
  doc: ExtendedDocumentInfo;
  pinned: boolean;
  enableBatchOperations: boolean;
  batchSelectedIds: Set<string>;
  deletingId: string | null;
  onDocumentClick: (id: string) => void;
  onToggleBatch: (id: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  return (
    <>
      <div
        className="flex items-start gap-2"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenuOpen(true);
        }}
      >
        {enableBatchOperations && (
          <div className="pt-3 pl-1">
            <Checkbox
              checked={batchSelectedIds.has(doc.documentId)}
              onCheckedChange={() => onToggleBatch(doc.documentId)}
              aria-label={`Select ${doc.fileName}`}
            />
          </div>
        )}
        <button
          onClick={() => onDocumentClick(doc.documentId)}
          className="flex-1 rounded-lg border p-3 pr-16 text-left transition-colors hover:bg-accent min-h-12"
        >
          <div className="flex items-start gap-3">
            {getFileIcon(doc.fileName)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="truncate font-medium text-sm">
                  {doc.fileName}
                </p>
                {getAccessBadge(doc.accessLevel)}
                {getStatusBadge(doc.status)}
                {doc.sharedWithCount !== undefined && doc.sharedWithCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    Shared with {doc.sharedWithCount}
                  </Badge>
                )}
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
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={`absolute right-8 top-2 transition-opacity ${pinned ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        aria-label={pinned ? 'Unpin document' : 'Pin document'}
      >
        <Star className={`h-4 w-4 ${pinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deletingId === doc.documentId}
      >
        {deletingId === doc.documentId ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
      <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <DropdownMenuTrigger asChild>
          <span className="absolute top-0 right-0 h-0 w-0 overflow-hidden" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onTogglePin}>
            <Star className={`mr-2 h-4 w-4 ${pinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function DocumentListContent({
  standalone,
  filter = 'owned',
  source,
  selectionMode = false,
  selectedIds = [],
  onSelectionChange,
  enableBatchOperations = false,
}: {
  standalone?: boolean;
  filter?: DocumentFilter;
  source?: DocumentSource;
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  enableBatchOperations?: boolean;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<ExtendedDocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('document-list');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(!standalone);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ documentId: string; fileName: string } | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const { pin, unpin, isPinned } = usePinning();

  async function fetchDocuments() {
    try {
      setLoading(true);
      setError(null);
      const sourceParam = source ? `&source=${source}` : '';
      const response = await fetch(`/api/documents?filter=${filter}${sourceParam}`, {
        credentials: 'include',
      });

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
  }, [filter, source]);

  function handleDocumentClick(documentId: string) {
    if (selectionMode) {
      toggleSelection(documentId);
      return;
    }
    if (!standalone) setIsOpen(false);
    router.push(`/documents/${documentId}`);
  }

  function toggleSelection(documentId: string) {
    if (!onSelectionChange) return;
    const newSelection = selectedIds.includes(documentId)
      ? selectedIds.filter(id => id !== documentId)
      : [...selectedIds, documentId];
    onSelectionChange(newSelection);
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    if (selectedIds.length === documents.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(documents.map(doc => doc.documentId));
    }
  }

  async function handleDelete(documentId: string, fileName: string) {
    setShowDeleteConfirm(true);
    setDeleteTarget({ documentId, fileName });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { documentId, fileName } = deleteTarget;

    setDeletingId(documentId);
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments((prev) => prev.filter((doc) => doc.documentId !== documentId));
      toast.success(`Deleted "${fileName}"`);
    } catch (err) {
      logger.error('Failed to delete document', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete document');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  function toggleBatchSelection(documentId: string) {
    setBatchSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }

  function toggleSelectAllBatch() {
    if (batchSelectedIds.size === documents.length) {
      setBatchSelectedIds(new Set());
    } else {
      setBatchSelectedIds(new Set(documents.map(doc => doc.documentId)));
    }
  }

  async function handleBatchDelete() {
    if (batchSelectedIds.size === 0) return;
    
    setBatchDeleting(true);
    try {
      const response = await fetch('/api/documents/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(batchSelectedIds) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete documents');
      }

      const data = await response.json();
      setDocuments(prev => prev.filter(doc => !batchSelectedIds.has(doc.documentId)));
      setBatchSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
      toast.success(`Deleted ${data.successful} document${data.successful !== 1 ? 's' : ''}`);
    } catch (err) {
      logger.error('Failed to batch delete', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete selected documents');
    } finally {
      setBatchDeleting(false);
    }
  }

  if (loading) {
    return <SkeletonDocumentList />;
  }

  if (error) {
    return <ListErrorState error={error} onRetry={fetchDocuments} />;
  }

  if (documents.length === 0) {
    const emptyConfig = {
      owned: {
        message: 'No documents yet',
        description: 'Upload documents or connect external sources to make them searchable with AI',
        icon: <FileText className="h-10 w-10 text-muted-foreground" />,
        action: 'Upload document' as const,
        secondaryActions: [
          { label: 'Connect Google Drive', onClick: () => window.location.href = '/settings/connectors' },
          { label: 'Connect Microsoft 365', onClick: () => window.location.href = '/settings/connectors' },
        ],
      },
      'shared-with-me': {
        message: 'No shared documents',
        description: 'Documents that others share with you will appear here',
        icon: <FileText className="h-10 w-10 text-muted-foreground" />,
        action: undefined,
        secondaryActions: [],
      },
      'shared-by-me': {
        message: 'No shared documents',
        description: 'Documents you have shared with others will appear here',
        icon: <FileText className="h-10 w-10 text-muted-foreground" />,
        action: undefined,
        secondaryActions: [],
      },
      pending: {
        message: 'No pending documents',
        description: 'Documents awaiting approval will appear here',
        icon: <FileText className="h-10 w-10 text-muted-foreground" />,
        action: undefined,
        secondaryActions: [],
      },
    };
    const cfg = emptyConfig[filter];
    return (
      <ListEmptyState
        message={cfg.message}
        description={cfg.description}
        icon={cfg.icon}
        action={cfg.action ? { label: cfg.action, onClick: () => window.dispatchEvent(new CustomEvent('open-upload-dialog')) } : undefined}
        secondaryActions={cfg.secondaryActions}
      />
    );
  }

  return (
    <>
    {enableBatchOperations && batchSelectedIds.size > 0 && (
      <div className="flex items-center gap-3 mb-3 p-3 rounded-lg border bg-muted/50">
        <span className="text-sm font-medium">
          {batchSelectedIds.size} selected
        </span>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowBatchDeleteConfirm(true)}
          disabled={batchDeleting}
        >
          {batchDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete Selected
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBatchSelectedIds(new Set())}
        >
          Clear selection
        </Button>
      </div>
    )}

    <ul className="space-y-2">
      {enableBatchOperations && (
        <li className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={documents.length > 0 && batchSelectedIds.size === documents.length}
            onCheckedChange={toggleSelectAllBatch}
            aria-label="Select all documents"
          />
          <span>Select all</span>
        </li>
      )}
      {documents.map((doc) => {
        const pinned = isPinned(doc.documentId, 'document');
        return (
          <li key={doc.documentId} className="group relative" data-testid="document-row" data-document-id={doc.documentId}>
            <DocumentRow
              doc={doc}
              pinned={pinned}
              enableBatchOperations={enableBatchOperations}
              batchSelectedIds={batchSelectedIds}
              deletingId={deletingId}
              onDocumentClick={handleDocumentClick}
              onToggleBatch={toggleBatchSelection}
              onTogglePin={() => pinned ? unpin(doc.documentId, 'document') : pin(doc.documentId, 'document', doc.fileName)}
              onDelete={() => handleDelete(doc.documentId, doc.fileName)}
            />
          </li>
        );
      })}
    </ul>

    <ConfirmDialog
      open={showDeleteConfirm}
      onOpenChange={setShowDeleteConfirm}
      title="Delete document?"
      description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.fileName}"? This action cannot be undone.` : ''}
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={confirmDelete}
      loading={deletingId === deleteTarget?.documentId}
    />

    <ConfirmDialog
      open={showBatchDeleteConfirm}
      onOpenChange={setShowBatchDeleteConfirm}
      title="Delete selected documents?"
      description={`Are you sure you want to delete ${batchSelectedIds.size} document${batchSelectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
      confirmLabel="Delete All"
      confirmVariant="destructive"
      onConfirm={handleBatchDelete}
      loading={batchDeleting}
    />
    </>
  );
}

export function DocumentList({ standalone, filter, source, enableBatchOperations = false }: DocumentListProps) {
  if (standalone) {
    return (
      <div className="rounded-lg border p-4">
        <DocumentListContent standalone filter={filter || 'owned'} source={source} enableBatchOperations={enableBatchOperations} />
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
          <DocumentListContent enableBatchOperations={enableBatchOperations} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
