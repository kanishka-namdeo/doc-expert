'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLogger } from '@/hooks/use-logger';

const ONBOARDING_KEY = 'doc-expert:onboarding-complete';

export function useOnboarding() {
  const logger = useLogger('hooks/onboarding');
  const [shouldShowWizard, setShouldShowWizard] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY)) {
          setShouldShowWizard(false);
          setIsChecking(false);
          return;
        }

        const [docsRes, convosRes] = await Promise.all([
          fetch('/api/documents', { credentials: 'include' }),
          fetch('/api/conversations', { credentials: 'include' }),
        ]);

        let docCount = 0;
        let convoCount = 0;

        if (docsRes.ok) {
          const docsData = (await docsRes.json()) as { documents?: unknown[] };
          docCount = docsData.documents?.length ?? 0;
        }

        if (convosRes.ok) {
          const convosData = (await convosRes.json()) as { conversations?: unknown[] };
          convoCount = convosData.conversations?.length ?? 0;
        }

        setShouldShowWizard(docCount === 0 || convoCount === 0);
      } catch (err) {
        logger.error('Failed to check onboarding state', { err });
        setShouldShowWizard(false);
      } finally {
        setIsChecking(false);
      }
    }

    check();
  }, [logger]);

  const completeOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    setShouldShowWizard(false);
  }, []);

  const skipOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    setShouldShowWizard(false);
  }, []);

  return { shouldShowWizard, isChecking, completeOnboarding, skipOnboarding };
}
