'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SearchScope } from '@/components/command-palette/scope-filter';
import { useLogger } from '@/hooks/use-logger';

const STORAGE_KEY = 'doc-expert:saved-searches';
const MAX_SAVED = 20;

export interface SavedSearch {
  id: string;
  query: string;
  scope: SearchScope;
  label?: string;
  savedAt: string;
}

export function useSavedSearches() {
  const logger = useLogger('use-saved-searches');

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((searches: SavedSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const save = useCallback((query: string, scope: SearchScope, label?: string) => {
    setSavedSearches((prev) => {
      const existing = prev.find((s) => s.query === query && s.scope === scope);
      if (existing) {
        logger.warn('Search already saved', { query, scope });
        return prev;
      }

      if (prev.length >= MAX_SAVED) {
        logger.warn('Saved searches limit reached', { max: MAX_SAVED });
        return prev;
      }

      const newSearch: SavedSearch = {
        id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        query,
        scope,
        label,
        savedAt: new Date().toISOString(),
      };

      const updated = [...prev, newSearch];
      persist(updated);
      logger.info('Search saved', { query, scope, label });
      return updated;
    });
  }, [persist, logger]);

  const remove = useCallback((id: string) => {
    setSavedSearches((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persist(updated);
      logger.info('Saved search removed', { id });
      return updated;
    });
  }, [persist, logger]);

  const clear = useCallback(() => {
    setSavedSearches([]);
    persist([]);
    logger.info('All saved searches cleared');
  }, [persist, logger]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const updated = JSON.parse(event.newValue) as SavedSearch[];
          setSavedSearches(updated);
          logger.debug('Saved searches synced from another tab', { count: updated.length });
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [logger]);

  return {
    savedSearches,
    save,
    remove,
    clear,
  };
}
