'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onFocusInput: () => void;
  onNewConversation: () => void;
  onOpenUpload: () => void;
  onStopStreaming: () => void;
  onOpenSearch?: () => void;
  onOpenTemplates?: () => void;
  onOpenShortcutsHelp?: () => void;
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
    };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;

      const target = event.target;

      // Ctrl/Cmd + K: Focus input (or open search if not focused)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
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
