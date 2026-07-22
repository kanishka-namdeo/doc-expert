'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLogger } from '@/hooks/use-logger';

const DISMISSED_KEY = 'doc-expert:checklist-dismissed';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export function useProgressChecklist() {
  const logger = useLogger('hooks/progress-checklist');
  const [hasDocuments, setHasDocuments] = useState(false);
  const [hasConversations, setHasConversations] = useState(false);
  const [hasCollections, setHasCollections] = useState(false);
  const [hasScopedSearch, setHasScopedSearch] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
    }
  }, []);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const [docsRes, convosRes, collectionsRes] = await Promise.all([
          fetch('/api/documents', { credentials: 'include' }),
          fetch('/api/conversations', { credentials: 'include' }),
          fetch('/api/collections', { credentials: 'include' }),
        ]);

        if (docsRes.ok) {
          const docsData = (await docsRes.json()) as { documents?: unknown[] };
          setHasDocuments((docsData.documents?.length ?? 0) > 0);
        }

        interface Conversation {
          id: string;
          collectionId?: string | null;
        }

        if (convosRes.ok) {
          const convosData = (await convosRes.json()) as { conversations?: Conversation[] };
          const convos = convosData.conversations ?? [];
          setHasConversations(convos.length > 0);
          setHasScopedSearch(convos.some((c) => !!c.collectionId));
        }

        if (collectionsRes.ok) {
          const collectionsData = (await collectionsRes.json()) as { collections?: unknown[] };
          setHasCollections((collectionsData.collections?.length ?? 0) > 0);
        }
      } catch (err) {
        logger.error('Failed to fetch progress checklist data', { err });
      } finally {
        setIsLoading(false);
      }
    }

    fetchProgress();
  }, [logger]);

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
    setIsDismissed(true);
  }, []);

  const allComplete = hasDocuments && hasConversations && hasCollections && hasScopedSearch;

  const items: ChecklistItem[] = [
    { id: 'upload', label: 'Upload a document', completed: hasDocuments },
    { id: 'ask', label: 'Ask your first question', completed: hasConversations },
    { id: 'collection', label: 'Create a collection', completed: hasCollections },
    { id: 'scoped', label: 'Try cross-document search', completed: hasScopedSearch },
  ];

  const completedCount = items.filter((i) => i.completed).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    allComplete,
    isDismissed,
    isLoading,
    dismiss,
  };
}
