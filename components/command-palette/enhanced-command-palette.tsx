'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { FileText, MessageSquare, FolderOpen, Sparkles } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
import type { SearchResult } from '@/lib/types/search';
import { ActionList } from './action-list';

interface EnhancedCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (result: SearchResult) => void;
}

export function EnhancedCommandPalette({ open, onOpenChange, onNavigate }: EnhancedCommandPaletteProps) {
  const router = useRouter();
  const logger = useLogger('command-palette');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    documents: SearchResult[];
    conversations: SearchResult[];
    collections: SearchResult[];
    messages: SearchResult[];
  }>({
    documents: [],
    conversations: [],
    collections: [],
    messages: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ documents: [], conversations: [], collections: [], messages: [] });
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ documents: [], conversations: [], collections: [], messages: [] });
      return;
    }

    setLoading(true);
    setError(null);
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        const res = await fetch(`/api/search?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults({
            documents: data.documents || [],
            conversations: data.conversations || [],
            collections: data.collections || [],
            messages: data.messages || [],
          });
        } else {
          setError('Search failed');
        }
      } catch (err) {
        logger.error('Search failed', { err });
        setError('Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    onOpenChange(false);
    if (onNavigate) {
      onNavigate(result);
      return;
    }
    if (result.type === 'conversation' || result.type === 'message') {
      router.push(`/?conversation=${result.id}`);
    } else if (result.type === 'document') {
      router.push(`/documents/${result.id}`);
    } else if (result.type === 'collection') {
      router.push(`/collections/${result.id}`);
    }
  }, [onOpenChange, onNavigate, router]);

  const handleRetry = useCallback(() => {
    if (query.trim()) {
      setQuery(query + ' ');
      setTimeout(() => setQuery(query), 0);
    }
  }, [query]);

  const hasResults = results.documents.length > 0 || 
                     results.conversations.length > 0 || 
                     results.collections.length > 0 || 
                     results.messages.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search documents, conversations, collections..."
    >
      <CommandInput
        placeholder="Search documents, conversations, collections..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {error && (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <button
              onClick={handleRetry}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        
        {!error && !query.trim() && <ActionList onSelect={() => onOpenChange(false)} />}
        
        {!error && query.trim() && !loading && !hasResults && (
          <CommandEmpty>No results found for &quot;{query}&quot;</CommandEmpty>
        )}

        {!error && hasResults && (
          <>
            {results.documents.length > 0 && (
              <CommandGroup heading="Documents">
                {results.documents.map((doc) => (
                  <CommandItem
                    key={doc.id}
                    value={`doc-${doc.id}`}
                    onSelect={() => handleSelect(doc)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{doc.title}</div>
                      {doc.excerpt && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {doc.excerpt}
                        </div>
                      )}
                    </div>
                    {doc.metadata.source && (
                      <div className="text-xs text-muted-foreground">
                        {doc.metadata.source}
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.conversations.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Conversations">
                  {results.conversations.map((conv) => (
                    <CommandItem
                      key={conv.id}
                      value={`conv-${conv.id}`}
                      onSelect={() => handleSelect(conv)}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{conv.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conv.metadata.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results.collections.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Collections">
                  {results.collections.map((col) => (
                    <CommandItem
                      key={col.id}
                      value={`col-${col.id}`}
                      onSelect={() => handleSelect(col)}
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{col.title}</div>
                        {col.excerpt && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {col.excerpt}
                          </div>
                        )}
                      </div>
                      {col.metadata.documentCount !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          {col.metadata.documentCount} docs
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results.messages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Messages">
                  {results.messages.map((msg) => (
                    <CommandItem
                      key={msg.id}
                      value={`msg-${msg.id}`}
                      onSelect={() => handleSelect(msg)}
                    >
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{msg.title}</div>
                        {msg.excerpt && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {msg.excerpt}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
