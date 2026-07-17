'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SourceDetail {
  sourceId: string;
  title: string;
  filename: string;
  mediaType: string;
  excerpt?: string;
}

interface CitationPanelProps {
  source: SourceDetail | null;
  onClose: () => void;
}

export function CitationPanel({ source, onClose }: CitationPanelProps) {
  if (!source) return null;

  return (
    <div className="w-80 border-l bg-background p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Source Details</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Document</label>
          <p className="text-sm font-medium">{source.title || source.filename}</p>
        </div>
        
        {source.excerpt && (
          <div>
            <label className="text-xs text-muted-foreground">Excerpt</label>
            <p className="text-sm mt-1 p-2 bg-muted rounded">{source.excerpt}</p>
          </div>
        )}
        
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <p className="text-sm">{source.mediaType}</p>
        </div>
      </div>
    </div>
  );
}
