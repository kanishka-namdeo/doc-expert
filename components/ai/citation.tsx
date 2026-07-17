'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CitationProps {
  sourceId: string;
  title?: string;
  filename?: string;
}

export function Citation({ sourceId, title, filename }: CitationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceData, setSourceData] = useState<{ text: string; fileName: string; chunkIndex?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setIsOpen(true);
    if (!sourceData) {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/sources?sourceId=${encodeURIComponent(sourceId)}`);
        if (!res.ok) throw new Error('Failed to load source');
        const data = await res.json();
        setSourceData(data);
      } catch (err) {
        console.error('Failed to fetch source:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const displayText = title || filename || 'Source';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 rounded-full',
          'bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
          'hover:bg-primary/20 transition-colors cursor-pointer'
        )}
        aria-label={`View source: ${displayText}`}
        title={displayText}
      >
        [{sourceId}]
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Source [{sourceId}]
              {sourceData?.fileName && <span className="text-sm font-normal text-muted-foreground ml-2">{sourceData.fileName}</span>}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading source...</div>
          ) : sourceData ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">{sourceData.text}</div>
              {sourceData.chunkIndex !== undefined && (
                <div className="text-xs text-muted-foreground">Chunk {sourceData.chunkIndex + 1}</div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-destructive">Failed to load source</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

