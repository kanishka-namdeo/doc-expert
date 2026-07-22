'use client';

import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  onFocusInput: () => void;
  onNewConversation: () => void;
  onOpenUpload: () => void;
  onStopStreaming: () => void;
  onOpenSearch?: () => void;
  onOpenTemplates?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenPinnedItem?: (index: number) => void;
  onGoToDocuments?: () => void;
  onGoToCollections?: () => void;
  onCycleModel?: () => void;
  onFocusCollectionFilter?: () => void;
  onCycleScope?: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function useKeyboardShortcuts({
  onFocusInput,
  onNewConversation,
  onOpenUpload,
  onStopStreaming,
  onOpenSearch,
  onOpenTemplates,
  onOpenShortcutsHelp,
  onOpenPinnedItem,
  onGoToDocuments,
  onGoToCollections,
  onCycleModel,
  onFocusCollectionFilter,
  onCycleScope,
  inputRef,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef({
    onFocusInput,
    onNewConversation,
    onOpenUpload,
    onStopStreaming,
    onOpenSearch: onOpenSearch || (() => {}),
    onOpenTemplates: onOpenTemplates || (() => {}),
    onOpenShortcutsHelp: onOpenShortcutsHelp || (() => {}),
    onOpenPinnedItem: onOpenPinnedItem || (() => {}),
    onGoToDocuments: onGoToDocuments || (() => {}),
    onGoToCollections: onGoToCollections || (() => {}),
    onCycleModel: onCycleModel || (() => {}),
    onFocusCollectionFilter: onFocusCollectionFilter || (() => {}),
    onCycleScope: onCycleScope || (() => {}),
  });

  useEffect(() => {
    shortcutsRef.current = {
      onFocusInput,
      onNewConversation,
      onOpenUpload,
      onStopStreaming,
      onOpenSearch: onOpenSearch || (() => {}),
      onOpenTemplates: onOpenTemplates || (() => {}),
      onOpenShortcutsHelp: onOpenShortcutsHelp || (() => {}),
      onOpenPinnedItem: onOpenPinnedItem || (() => {}),
      onGoToDocuments: onGoToDocuments || (() => {}),
      onGoToCollections: onGoToCollections || (() => {}),
      onCycleModel: onCycleModel || (() => {}),
      onFocusCollectionFilter: onFocusCollectionFilter || (() => {}),
      onCycleScope: onCycleScope || (() => {}),
    };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;

      const target = event.target;

      // Ctrl/Cmd + 1-9: Open Nth pinned item
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        const num = parseInt(event.key, 10);
        if (num >= 1 && num <= 9) {
          event.preventDefault();
          shortcutsRef.current.onOpenPinnedItem(num - 1);
          return;
        }
      }

      // Ctrl/Cmd + K: Focus input (or open search if not focused)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k' && !event.shiftKey) {
        event.preventDefault();
        if (isTypingTarget(target)) {
          shortcutsRef.current.onOpenSearch?.();
        } else {
          shortcutsRef.current.onFocusInput();
        }
        return;
      }

      // Ctrl/Cmd + Shift + K: Open search dialog
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'K') {
        event.preventDefault();
        shortcutsRef.current.onOpenSearch?.();
        return;
      }

      // Ctrl/Cmd + Shift + N: New conversation
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
        event.preventDefault();
        shortcutsRef.current.onNewConversation();
        return;
      }

      // Ctrl/Cmd + T: Open template picker
      if ((event.ctrlKey || event.metaKey) && event.key === 't' && !event.shiftKey) {
        event.preventDefault();
        shortcutsRef.current.onOpenTemplates();
        return;
      }

      // Ctrl/Cmd + U: Open upload dialog
      if ((event.ctrlKey || event.metaKey) && event.key === 'u' && !event.shiftKey) {
        event.preventDefault();
        shortcutsRef.current.onOpenUpload();
        return;
      }

      // Ctrl/Cmd + G: Go to documents page
      if ((event.ctrlKey || event.metaKey) && event.key === 'g' && !event.shiftKey) {
        event.preventDefault();
        shortcutsRef.current.onGoToDocuments();
        return;
      }

      // Ctrl/Cmd + Shift + C: Go to collections page
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        event.preventDefault();
        shortcutsRef.current.onGoToCollections();
        return;
      }

      // Ctrl/Cmd + M: Cycle through recent models
      if ((event.ctrlKey || event.metaKey) && event.key === 'm' && !event.shiftKey) {
        event.preventDefault();
        shortcutsRef.current.onCycleModel();
        return;
      }

      // Ctrl/Cmd + Shift + F: Focus collection filter
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault();
        shortcutsRef.current.onFocusCollectionFilter();
        return;
      }

      // Ctrl/Cmd + /: Cycle search scope
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        shortcutsRef.current.onCycleScope();
        return;
      }

      // Ctrl/Cmd + A: Select all (only inside command palette — handled by palette itself)
      // We intentionally do NOT intercept Ctrl+A globally to avoid breaking normal text selection.

      // Escape: Stop streaming or blur input
      if (event.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
          return;
        }
        shortcutsRef.current.onStopStreaming();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inputRef]);
}
