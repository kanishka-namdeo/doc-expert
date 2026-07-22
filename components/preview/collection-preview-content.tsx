'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, FileText, Calendar } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';

interface CollectionPreview {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  createdAt: string;
}

interface CollectionPreviewContentProps {
  collectionId: string;
}

export function CollectionPreviewContent({ collectionId }: CollectionPreviewContentProps) {
  const logger = useLogger('collection-preview');
  const [collection, setCollection] = useState<CollectionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchCollection() {
      try {
        const res = await fetch(`/api/collections/${collectionId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCollection(data);
        } else {
          setError(true);
        }
      } catch (err) {
        logger.error('Failed to fetch collection preview', { err, collectionId });
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchCollection();
  }, [collectionId, logger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-xs text-destructive">Failed to load preview</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{collection.name}</div>
          {collection.description && (
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {collection.description}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>{collection.documentCount} documents</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{new Date(collection.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
