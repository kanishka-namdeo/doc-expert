'use client';

import { useRouter } from 'next/navigation';
import { useRecentDocuments } from '@/hooks/use-recent-documents';
import { DocumentChip } from './document-chip';
import { CollectionBadge } from './collection-badge';
import { Button } from '@/components/ui/button';

interface QuickAccessBarProps {
  selectedCollectionId?: string | null;
}

export function QuickAccessBar({ selectedCollectionId }: QuickAccessBarProps) {
  const router = useRouter();
  const { recentDocuments, clearRecentDocuments } = useRecentDocuments();

  if (recentDocuments.length === 0 && !selectedCollectionId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
      {selectedCollectionId && (
        <CollectionBadge collectionId={selectedCollectionId} />
      )}
      
      {recentDocuments.length > 0 && (
        <>
          {selectedCollectionId && <div className="w-px h-4 bg-border" />}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Recent:</span>
            {recentDocuments.map((doc) => (
              <DocumentChip
                key={doc.id}
                documentId={doc.id}
                title={doc.title}
                onClick={() => router.push(`/documents/${doc.id}`)}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRecentDocuments}
              className="text-xs h-6 px-2"
            >
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
