'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Citation } from './citation';

interface Source {
  sourceId: string;
  title?: string;
  filename?: string;
}

interface SourcesProps {
  sources: Source[];
}

export function Sources({ sources }: SourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
      >
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {sources.map((source, idx) => (
            <div key={source.sourceId} className="rounded-md bg-muted/50 p-2 text-sm">
              <Citation
                sourceId={source.sourceId}
                title={`${idx + 1}. ${source.title || source.filename || 'Unknown'}`}
                filename={source.filename}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

