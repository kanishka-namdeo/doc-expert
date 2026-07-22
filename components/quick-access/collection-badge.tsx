'use client';

import { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { ContextualPreviewPopover } from '@/components/preview/contextual-preview-popover';

interface CollectionBadgeProps {
  collectionId: string;
}

export function CollectionBadge({ collectionId }: CollectionBadgeProps) {
  const [name, setName] = useState<string>('');

  useEffect(() => {
    async function fetchCollection() {
      try {
        const res = await fetch(`/api/collections/${collectionId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setName(data.name);
        }
      } catch {
        // Ignore errors
      }
    }
    fetchCollection();
  }, [collectionId]);

  if (!name) return null;

  return (
    <ContextualPreviewPopover type="collection" id={collectionId} side="bottom">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium cursor-pointer hover:bg-primary/20 transition-colors">
        <FolderOpen className="h-3 w-3" />
        <span className="truncate max-w-[120px]">{name}</span>
      </div>
    </ContextualPreviewPopover>
  );
}
