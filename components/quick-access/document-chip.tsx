'use client';

import { FileText } from 'lucide-react';
import { ContextualPreviewPopover } from '@/components/preview/contextual-preview-popover';

interface DocumentChipProps {
  documentId: string;
  title: string;
  onClick: () => void;
}

export function DocumentChip({ documentId, title, onClick }: DocumentChipProps) {
  return (
    <ContextualPreviewPopover type="document" id={documentId} side="bottom">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-2 py-1 bg-background border rounded-md text-xs font-medium hover:bg-accent transition-colors"
      >
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="truncate max-w-[120px]">{title}</span>
      </button>
    </ContextualPreviewPopover>
  );
}
