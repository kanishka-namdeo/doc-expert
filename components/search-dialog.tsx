'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FileText, MessageSquare, Search, X } from 'lucide-react';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet?: string;
  createdAt: Date | number;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        const res = await fetch(`/api/search?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    onOpenChange(false);
    if (result.type === 'conversation') {
      router.push(`/?conversation=${result.id}`);
    } else if (result.type === 'document') {
      router.push(`/documents/${result.id}`);
    }
  }, [onOpenChange, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [results, selectedIndex, handleSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations and documents..."
            className="border-0 focus-visible:ring-0 text-sm"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="ml-auto">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">Searching...</div>
        )}

        {!loading && results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((result, i) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`flex w-full items-start gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                {result.type === 'conversation' ? (
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{result.title}</p>
                  {result.snippet && (
                    <p className="truncate text-xs text-muted-foreground">{result.snippet}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 uppercase">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No results found for &quot;{query}&quot;
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
