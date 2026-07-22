'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export type PaletteSection = 'pinned' | 'history' | 'documents' | 'conversations' | 'collections';

const SECTION_ORDER: PaletteSection[] = ['pinned', 'history', 'documents', 'conversations', 'collections'];

interface UsePaletteNavigationOptions {
  isOpen: boolean;
  itemCounts: Record<PaletteSection, number>;
}

export function usePaletteNavigation({ isOpen, itemCounts }: UsePaletteNavigationOptions) {
  const [focusedSection, setFocusedSection] = useState<PaletteSection>('pinned');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const prevOpenRef = useRef(isOpen);

  if (prevOpenRef.current && !isOpen) {
    setFocusedSection('pinned');
    setFocusedIndex(0);
  }

  if (prevOpenRef.current !== isOpen) {
    prevOpenRef.current = isOpen;
  }

  const cycleSection = useCallback((direction: 1 | -1) => {
    setFocusedSection((prev) => {
      const currentIndex = SECTION_ORDER.indexOf(prev);
      const nextIndex = (currentIndex + direction + SECTION_ORDER.length) % SECTION_ORDER.length;
      return SECTION_ORDER[nextIndex];
    });
    setFocusedIndex(0);
  }, []);

  const jumpToIndex = useCallback((index: number) => {
    const count = itemCounts[focusedSection];
    if (index >= 0 && index < count) {
      setFocusedIndex(index);
    }
  }, [focusedSection, itemCounts]);

  const getItemId = useCallback((section: PaletteSection, index: number): string | null => {
    if (index < 0 || index >= itemCounts[section]) {
      return null;
    }
    return `${section}-${index}`;
  }, [itemCounts]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleSection(e.shiftKey ? -1 : 1);
        return;
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          jumpToIndex(num - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cycleSection, jumpToIndex]);

  return {
    focusedSection,
    focusedIndex,
    setFocusedSection,
    setFocusedIndex,
    getItemId,
  };
}
