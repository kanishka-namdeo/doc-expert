'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { FileText, MessageSquare, FolderOpen, Sparkles, Star, BookTemplate, Search } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
import { usePinning } from '@/hooks/use-pinning';
import { useSavedSearches } from '@/hooks/use-saved-searches';
import { useSearchHistory } from '@/hooks/use-search-history';
import type { SearchResult } from '@/lib/types/search';
import { ActionList } from './action-list';
import { ScopeFilter, type SearchScope } from './scope-filter';
import { BulkActionsPanel } from './bulk-actions-panel';
import { PreviewPopover } from './preview-popover';

interface EnhancedCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (result: SearchResult) => void;
}

export function EnhancedCommandPalette({ open, onOpenChange, onNavigate }: EnhancedCommandPaletteProps) {
  const router = useRouter();
  const logger = useLogger('command-palette');
  const { pinnedItems, pin, unpin, isPinned } = usePinning();
  const { savedSearches } = useSavedSearches();
  const { addSearch } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<SearchResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ documents: [], conversations: [], collections: [], messages: [] });
      setError(null);
      setScope('all');
      setSelectedIds([]);
      setPreviewOpen(false);
      setPreviewItem(null);
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
      addSearch(query, scope);
      try {
        const params = new URLSearchParams({ q: query });
        if (scope !== 'all') {
          params.set('scope', scope);
        }
        const res = await fetch(`/api/search?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults({
            documents: scope === 'all' || scope === 'documents' ? (data.documents || []) : [],
            conversations: scope === 'all' || scope === 'semantic' ? (data.conversations || []) : [],
            collections: scope === 'all' || scope === 'collections' ? (data.collections || []) : [],
            messages: scope === 'all' || scope === 'semantic' ? (data.messages || []) : [],
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
  }, [query, scope, logger, addSearch]);

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

  const handleTogglePinSelected = useCallback(() => {
    const selectedItem = document.querySelector('[data-selected="true"][cmdk-item]');
    if (!selectedItem) return;

    const value = selectedItem.getAttribute('data-value');
    if (!value) return;

    if (value.startsWith('pinned-')) {
      const parts = value.split('-');
      if (parts.length >= 3) {
        const type = parts[1] as 'document' | 'collection' | 'template';
        const id = parts.slice(2).join('-');
        const pinned = isPinned(id, type);
        if (pinned) {
          unpin(id, type);
        } else {
          const title = selectedItem.textContent || '';
          pin(id, type, title);
        }
      }
    }
  }, [isPinned, pin, unpin]);

  const handleSelectAll = useCallback(() => {
    const docIds = results.documents.map((d) => d.id);
    setSelectedIds(docIds);
  }, [results.documents]);

  const handlePreview = useCallback(() => {
    const selectedItem = document.querySelector('[data-selected="true"][cmdk-item]');
    if (!selectedItem) return;

    const value = selectedItem.getAttribute('data-value');
    if (!value) return;

    if (value.startsWith('doc-')) {
      const id = value.slice(4);
      const doc = results.documents.find((d) => d.id === id);
      if (doc) {
        setPreviewItem(doc);
        setPreviewOpen(true);
      }
    } else if (value.startsWith('col-')) {
      const id = value.slice(4);
      const col = results.collections.find((c) => c.id === id);
      if (col) {
        setPreviewItem(col);
        setPreviewOpen(true);
      }
    }
  }, [results.documents, results.collections]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handleTogglePinSelected();
        return;
      }

      if (e.ctrlKey && e.key === 'a') {
        const activeEl = document.activeElement;
        if (activeEl?.closest('[cmdk-root]')) {
          e.preventDefault();
          handleSelectAll();
        }
        return;
      }

      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handlePreview();
        return;
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleTogglePinSelected, handleSelectAll, handlePreview]);

  const hasResults = results.documents.length > 0 || 
                     results.conversations.length > 0 || 
                     results.collections.length > 0 || 
                     results.messages.length > 0;

  const filteredSavedSearches = useMemo(() => {
    if (!query.trim()) return savedSearches;
    return savedSearches.filter((s) =>
      s.query.toLowerCase().includes(query.toLowerCase()) ||
      (s.label && s.label.toLowerCase().includes(query.toLowerCase()))
    );
  }, [savedSearches, query]);

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
      <ScopeFilter scope={scope} onScopeChange={setScope} />
      <CommandList aria-busy={loading}>
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

        {!error && !query.trim() && pinnedItems.length > 0 && (
          <CommandGroup heading="Pinned">
            {pinnedItems.map((item, index) => {
              const Icon = item.type === 'document' ? FileText
                : item.type === 'collection' ? FolderOpen
                : item.type === 'template' ? BookTemplate
                : Star;
              return (
                <CommandItem
                  key={`pinned-${item.type}-${item.id}`}
                  value={`pinned-${item.type}-${item.id}`}
                  onSelect={() => {
                    onOpenChange(false);
                    if (item.type === 'document') {
                      router.push(`/documents/${item.id}`);
                    } else if (item.type === 'collection') {
                      router.push(`/collections/${item.id}`);
                    }
                  }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{item.type}</div>
                  </div>
                  <span className="text-xs text-muted-foreground mr-2">Ctrl+{index + 1}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {!error && !query.trim() && filteredSavedSearches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Saved Searches">
              {filteredSavedSearches.map((saved) => (
                <CommandItem
                  key={`saved-${saved.id}`}
                  value={`saved-${saved.id}`}
                  onSelect={() => {
                    setQuery(saved.query);
                    setScope(saved.scope);
                  }}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{saved.label || saved.query}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {saved.scope}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!error && !query.trim() && <CommandSeparator />}
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
      <BulkActionsPanel
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onAddToCollection={() => {
          logger.info('Bulk add to collection', { count: selectedIds.length });
          setSelectedIds([]);
        }}
        onExport={() => {
          logger.info('Bulk export', { count: selectedIds.length });
          setSelectedIds([]);
        }}
        onDelete={() => {
          logger.info('Bulk delete', { count: selectedIds.length });
          setSelectedIds([]);
        }}
        onShare={() => {
          logger.info('Bulk share', { count: selectedIds.length });
          setSelectedIds([]);
        }}
      />
      <PreviewPopover
        item={previewItem}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onOpen={() => {
          if (previewItem) handleSelect(previewItem);
          setPreviewOpen(false);
        }}
        onPin={() => {
          if (previewItem) {
            const pinned = isPinned(previewItem.id, previewItem.type as 'document' | 'collection');
            if (pinned) {
              unpin(previewItem.id, previewItem.type as 'document' | 'collection');
            } else {
              pin(previewItem.id, previewItem.type as 'document' | 'collection', previewItem.title);
            }
          }
        }}
        onShare={() => {
          if (previewItem) {
            logger.info('Share from preview', { itemId: previewItem.id });
          }
        }}
        isPinned={previewItem ? isPinned(previewItem.id, previewItem.type as 'document' | 'collection') : false}
      >
        <span />
      </PreviewPopover>
    </CommandDialog>
  );
}
