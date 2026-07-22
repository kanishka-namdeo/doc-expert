'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PinnedItem } from '@/lib/types/pinning';
import { useLogger } from '@/hooks/use-logger';

const STORAGE_KEY = 'doc-expert:pinned-items';
const MAX_PINNED = 10;
const PERSIST_DEBOUNCE_MS = 100;

export function usePinning() {
  const logger = useLogger('use-pinning');
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const items = stored ? JSON.parse(stored) : [];
      return items.sort((a: PinnedItem, b: PinnedItem) => a.order - b.order);
    } catch {
      return [];
    }
  });

  const persist = useCallback((items: PinnedItem[]) => {
    // Debounce rapid writes (e.g., during drag reorder)
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const pin = useCallback((id: string, type: PinnedItem['type'], title: string) => {
    setPinnedItems((prev) => {
      const exists = prev.find((item) => item.id === id && item.type === type);
      if (exists) {
        logger.warn('Item already pinned', { id, type });
        return prev;
      }

      if (prev.length >= MAX_PINNED) {
        logger.warn('Pin limit reached', { max: MAX_PINNED });
        return prev;
      }

      const newItem: PinnedItem = {
        id,
        type,
        title,
        pinnedAt: new Date().toISOString(),
        order: prev.length,
      };

      const updated = [...prev, newItem];
      persist(updated);
      logger.info('Item pinned', { id, type, title });
      return updated;
    });
  }, [persist, logger]);

  const unpin = useCallback((id: string, type?: PinnedItem['type']) => {
    setPinnedItems((prev) => {
      const updated = prev.filter((item) => {
        if (type) {
          return !(item.id === id && item.type === type);
        }
        return item.id !== id;
      });
      persist(updated);
      logger.info('Item unpinned', { id, type });
      return updated;
    });
  }, [persist, logger]);

  const isPinned = useCallback((id: string, type?: PinnedItem['type']) => {
    return pinnedItems.some((item) => {
      if (type) {
        return item.id === id && item.type === type;
      }
      return item.id === id;
    });
  }, [pinnedItems]);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setPinnedItems((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }

      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Update order values
      const reordered = updated.map((item, index) => ({
        ...item,
        order: index,
      }));

      persist(reordered);
      logger.info('Items reordered', { fromIndex, toIndex });
      return reordered;
    });
  }, [persist, logger]);

  const clearAll = useCallback(() => {
    setPinnedItems([]);
    persist([]);
    logger.info('All pinned items cleared');
  }, [persist, logger]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const updated = JSON.parse(event.newValue) as PinnedItem[];
          setPinnedItems(updated.sort((a, b) => a.order - b.order));
          logger.debug('Pinned items synced from another tab', { count: updated.length });
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [logger]);

  return {
    pinnedItems,
    pin,
    unpin,
    isPinned,
    reorder,
    clearAll,
  };
}
