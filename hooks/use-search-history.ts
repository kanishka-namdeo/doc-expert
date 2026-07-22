'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLogger } from '@/hooks/use-logger';

const STORAGE_KEY = 'doc-expert:search-history';
const MAX_HISTORY = 20;

export interface SearchHistoryEntry {
  id: string;
  query: string;
  scope: 'all' | 'documents' | 'collections' | 'semantic';
  timestamp: string;
}

export function useSearchHistory() {
  const logger = useLogger('use-search-history');

  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((entries: SearchHistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const addSearch = useCallback((query: string, scope: SearchHistoryEntry['scope'] = 'all') => {
    if (!query.trim()) return;

    setHistory((prev) => {
      const filtered = prev.filter(
        (entry) => entry.query.toLowerCase() !== query.trim().toLowerCase()
      );

      const entry: SearchHistoryEntry = {
        id: crypto.randomUUID(),
        query: query.trim(),
        scope,
        timestamp: new Date().toISOString(),
      };

      const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
      persist(updated);
      logger.debug('Search added to history', { queryLength: query.length, scope });
      return updated;
    });
  }, [persist, logger]);

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((entry) => entry.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    persist([]);
    logger.info('Search history cleared');
  }, [persist, logger]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const updated = JSON.parse(event.newValue) as SearchHistoryEntry[];
          setHistory(updated);
          logger.debug('Search history synced from another tab', { count: updated.length });
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [logger]);

  const recentSearches = history.slice(0, 5);

  return {
    history,
    recentSearches,
    addSearch,
    removeEntry,
    clearHistory,
  };
}
