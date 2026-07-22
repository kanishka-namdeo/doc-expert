'use client';

import { FolderPlus, Download, Trash2, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogger } from '@/hooks/use-logger';

interface BulkActionsPanelProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onAddToCollection: () => void;
  onExport: () => void;
  onDelete: () => void;
  onShare: () => void;
}

export function BulkActionsPanel({
  selectedIds,
  onClearSelection,
  onAddToCollection,
  onExport,
  onDelete,
  onShare,
}: BulkActionsPanelProps) {
  const logger = useLogger('bulk-actions-panel');

  if (selectedIds.length === 0) return null;

  const handleAction = (action: string, callback: () => void) => {
    logger.info('Bulk action triggered', { action, count: selectedIds.length });
    callback();
  };

  return (
    <div className="flex items-center gap-2 border-t bg-muted/50 px-3 py-2" role="toolbar" aria-label="Bulk actions">
      <span className="text-sm text-muted-foreground">
        {selectedIds.length} selected
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAction('addToCollection', onAddToCollection)}
          className="h-7 px-2 text-xs"
        >
          <FolderPlus className="h-3 w-3 mr-1" />
          Add to Collection
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAction('export', onExport)}
          className="h-7 px-2 text-xs"
        >
          <Download className="h-3 w-3 mr-1" />
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAction('share', onShare)}
          className="h-7 px-2 text-xs"
        >
          <Share2 className="h-3 w-3 mr-1" />
          Share
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAction('delete', onDelete)}
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 w-7 p-0"
          aria-label="Clear selection"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
