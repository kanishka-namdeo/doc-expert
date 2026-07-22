'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLogger } from '@/hooks/use-logger';

const STORAGE_KEY = 'doc-expert:context-presets';

export interface ContextPreset {
  id: string;
  label: string;
  modelId: string;
  collectionId: string | null;
  createdAt: string;
}

export function useContextPresets() {
  const logger = useLogger('use-context-presets');

  const [presets, setPresets] = useState<ContextPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((items: ContextPreset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const savePreset = useCallback(
    (label: string, modelId: string, collectionId: string | null) => {
      if (!label.trim()) {
        logger.warn('Preset label is empty');
        return;
      }

      setPresets((prev) => {
        const preset: ContextPreset = {
          id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          label: label.trim(),
          modelId,
          collectionId,
          createdAt: new Date().toISOString(),
        };

        const updated = [...prev, preset];
        persist(updated);
        logger.info('Preset saved', { label, modelId, collectionId });
        return updated;
      });
    },
    [persist, logger]
  );

  const loadPreset = useCallback(
    (id: string): ContextPreset | undefined => {
      return presets.find((p) => p.id === id);
    },
    [presets]
  );

  const deletePreset = useCallback(
    (id: string) => {
      setPresets((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        persist(updated);
        logger.info('Preset deleted', { id });
        return updated;
      });
    },
    [persist, logger]
  );

  const clearAll = useCallback(() => {
    setPresets([]);
    persist([]);
    logger.info('All presets cleared');
  }, [persist, logger]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const updated = JSON.parse(event.newValue) as ContextPreset[];
          setPresets(updated);
          logger.debug('Presets synced from another tab', { count: updated.length });
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [logger]);

  return {
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    clearAll,
  };
}
