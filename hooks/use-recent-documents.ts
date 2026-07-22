'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'doc-expert:recent-documents';
const MAX_RECENT = 5;

interface RecentDocument {
  id: string;
  title: string;
  accessedAt: string;
}

export function useRecentDocuments() {
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addRecentDocument = useCallback((id: string, title: string) => {
    setRecentDocs((prev) => {
      const filtered = prev.filter((doc) => doc.id !== id);
      const updated = [
        { id, title, accessedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_RECENT);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      
      return updated;
    });
  }, []);

  const clearRecentDocuments = useCallback(() => {
    setRecentDocs([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    recentDocuments: recentDocs,
    addRecentDocument,
    clearRecentDocuments,
  };
}
