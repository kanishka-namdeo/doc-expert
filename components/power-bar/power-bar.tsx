'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLogger } from '@/hooks/use-logger';
import { PinnedZone } from './pinned-zone';
import { SearchHistoryZone } from './search-history-zone';
import { SavedSearchesZone } from './saved-searches-zone';
import { ContextZone } from './context-zone';
import { SaveSearchDialog } from '@/components/save-search-dialog';
import type { SearchScope } from '@/components/command-palette/scope-filter';

const COLLAPSED_STORAGE_KEY = 'doc-expert:power-bar-collapsed';

interface PowerBarProps {
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onSearchSelect?: (query: string) => void;
}

export function PowerBar({
  selectedCollectionId,
  setSelectedCollectionId,
  selectedModel,
  setSelectedModel,
  onSearchSelect,
}: PowerBarProps) {
  const logger = useLogger('power-bar');
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ query: string; scope: SearchScope } | null>(null);

  const handleSaveSearch = useCallback((query: string, scope: SearchScope) => {
    setPendingSave({ query, scope });
    setSaveDialogOpen(true);
  }, []);

  const handleSearchSelectWithScope = useCallback(
    (query: string, scope: string) => {
      if (onSearchSelect) {
        onSearchSelect(query);
      }
      logger.info('Saved search selected', { queryLength: query.length, scope });
    },
    [onSearchSelect, logger]
  );

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors
    }
    logger.info('Power bar collapsed state changed', { collapsed });
  }, [collapsed, logger]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30"
      role="toolbar"
      aria-label="Power bar"
    >
      {/* Screen reader announcements for dynamic updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Power bar updated
      </div>

      <div className="flex-1 flex items-center gap-2 overflow-x-auto">
        <PinnedZone collapsed={collapsed} />

        {/* Search history zone - hidden on mobile when collapsed */}
        <div className="hidden sm:block">
          <SearchHistoryZone collapsed={collapsed} onSearchSelect={onSearchSelect} onSaveSearch={handleSaveSearch} />
        </div>

        {/* Saved searches zone - hidden on mobile when collapsed */}
        <div className="hidden sm:block">
          <SavedSearchesZone collapsed={collapsed} onSearchSelect={handleSearchSelectWithScope} />
        </div>

        <ContextZone
          selectedCollectionId={selectedCollectionId}
          setSelectedCollectionId={setSelectedCollectionId}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          collapsed={collapsed}
        />
      </div>

      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-7 w-7 shrink-0"
            aria-label={collapsed ? 'Expand power bar' : 'Collapse power bar'}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {collapsed ? 'Expand' : 'Collapse'}
        </TooltipContent>
      </Tooltip>

      <SaveSearchDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        query={pendingSave?.query || ''}
        scope={pendingSave?.scope || 'all'}
      />
    </div>
  );
}
