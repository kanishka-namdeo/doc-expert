'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { HINTS, type Hint, type HintContext } from '@/lib/onboarding/hints';

const HISTORY_KEY = 'doc-expert:hint-history';

interface HintRecord {
  shownAt: number;
  dismissedAt?: number;
}

interface HintHistory {
  [hintId: string]: HintRecord;
}

function getHistory(): HintHistory {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HintHistory) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: HintHistory) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function isHintAvailable(hint: Hint, history: HintHistory): boolean {
  const record = history[hint.id];
  if (!record) return true;

  const now = Date.now();
  const cooldownMs = hint.cooldownDays * 24 * 60 * 60 * 1000;

  if (record.dismissedAt) {
    return now - record.dismissedAt >= cooldownMs;
  }

  return now - record.shownAt >= cooldownMs;
}

export function useOnboardingHints() {
  const [context, setContext] = useState<HintContext>({
    messageCount: 0,
    hasCollection: false,
    hasDocuments: false,
    documentCount: 0,
    collectionDocumentCount: 0,
    isFirstDocumentView: false,
    conversationMessageCount: 0,
  });

  const shownInSessionRef = useRef<Set<string>>(new Set());

  const updateContext = useCallback((updates: Partial<HintContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  const markHintShown = useCallback((hintId: string) => {
    const history = getHistory();
    history[hintId] = { shownAt: Date.now() };
    saveHistory(history);
    shownInSessionRef.current.add(hintId);
  }, []);

  const dismissHint = useCallback((hintId: string) => {
    const history = getHistory();
    if (history[hintId]) {
      history[hintId].dismissedAt = Date.now();
      saveHistory(history);
    }
  }, []);

  const evaluateHints = useCallback(() => {
    const history = getHistory();

    for (const hint of HINTS) {
      if (shownInSessionRef.current.has(hint.id)) continue;
      if (!isHintAvailable(hint, history)) continue;
      if (!hint.trigger(context)) continue;

      toast(hint.title, {
        description: hint.description,
        duration: 8000,
        action: hint.actionLabel
          ? {
              label: hint.actionLabel,
              onClick: () => {
                if (hint.actionHref) {
                  window.location.href = hint.actionHref;
                }
              },
            }
          : undefined,
      });

      markHintShown(hint.id);
      break;
    }
  }, [context, markHintShown]);

  useEffect(() => {
    evaluateHints();
  }, [evaluateHints]);

  return {
    updateContext,
    dismissHint,
  };
}
