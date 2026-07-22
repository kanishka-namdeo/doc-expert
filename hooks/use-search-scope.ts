'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLogger } from '@/hooks/use-logger';
import type { SearchScope } from '@/components/command-palette/scope-filter';

export type SearchContext = 'chat' | 'documents' | 'collections' | 'viewer';

const STORAGE_KEY_PREFIX = 'doc-expert:search-scope-';

export function useSearchScope(context: SearchContext) {
  const logger = useLogger('use-search-scope');

  const [scope, setScopeState] = useState<SearchScope>(() => {
    if (typeof window === 'undefined') return 'all';
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${context}`);
      return stored ? (stored as SearchScope) : 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${context}`, scope);
    } catch {
      // Ignore storage errors
    }
    logger.debug('Search scope persisted', { context, scope });
  }, [scope, context, logger]);

  const setScope = useCallback((newScope: SearchScope) => {
    setScopeState(newScope);
    logger.info('Search scope changed', { context, scope: newScope });
  }, [context, logger]);

  const resetScope = useCallback(() => {
    setScopeState('all');
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${context}`);
    } catch {
      // Ignore storage errors
    }
    logger.info('Search scope reset', { context });
  }, [context, logger]);

  return {
    scope,
    setScope,
    resetScope,
  };
}
