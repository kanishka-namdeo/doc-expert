'use client';

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen, Star, Share2, ExternalLink } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
import type { SearchResult } from '@/lib/types/search';

interface PreviewPopoverProps {
  children: React.ReactNode;
  item: SearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onPin: () => void;
  onShare: () => void;
  isPinned?: boolean;
}

export function PreviewPopover({
  children,
  item,
  open,
  onOpenChange,
  onOpen,
  onPin,
  onShare,
  isPinned = false,
}: PreviewPopoverProps) {
  const logger = useLogger('preview-popover');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;

    const fetchPreview = async () => {
      setLoading(true);
      try {
        const endpoint = item.type === 'document' 
          ? `/api/documents/${item.id}/preview`
          : item.type === 'collection'
          ? `/api/collections/${item.id}/preview`
          : null;

        if (!endpoint) return;

        const res = await fetch(endpoint, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPreviewContent(data.content?.slice(0, 500) || 'No preview available');
        }
      } catch (err) {
        logger.error('Failed to fetch preview', { err, itemId: item.id });
        setPreviewContent('Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [open, item, logger]);

  if (!item) return null;

  const Icon = item.type === 'document' ? FileText : FolderOpen;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent className="w-96" align="start" side="right" aria-label="Preview">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-muted-foreground capitalize mt-0.5">
                {item.type}
                {item.metadata.source && ` • ${item.metadata.source}`}
              </div>
            </div>
          </div>

          <div className="border rounded-md p-2 bg-muted/30">
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading preview...</div>
            ) : (
              <div className="text-xs text-muted-foreground line-clamp-6">
                {previewContent || 'No preview available'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpen}
              className="h-7 px-2 text-xs flex-1"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onPin}
              className="h-7 px-2 text-xs"
            >
              <Star className={`h-3 w-3 mr-1 ${isPinned ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              {isPinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="h-7 px-2 text-xs"
            >
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
