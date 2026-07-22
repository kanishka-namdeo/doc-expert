'use client';

import { useCallback, memo } from 'react';
import { Clock, Star, Globe, FileText, FolderOpen, BrainCircuit } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useLogger } from '@/hooks/use-logger';
import type { SearchHistoryEntry } from '@/hooks/use-search-history';

interface SearchHistoryZoneProps {
  collapsed: boolean;
  onSearchSelect?: (query: string) => void;
  onSaveSearch?: (query: string, scope: SearchHistoryEntry['scope']) => void;
}

const scopeIcons: Record<SearchHistoryEntry['scope'], React.ComponentType<{ className?: string }>> = {
  all: Globe,
  documents: FileText,
  collections: FolderOpen,
  semantic: BrainCircuit,
};

const scopeLabels: Record<SearchHistoryEntry['scope'], string> = {
  all: 'All',
  documents: 'Documents',
  collections: 'Collections',
  semantic: 'Semantic',
};

export const SearchHistoryZone = memo(function SearchHistoryZone({ collapsed, onSearchSelect, onSaveSearch }: SearchHistoryZoneProps) {
  const logger = useLogger('search-history-zone');
  const { recentSearches } = useSearchHistory();

  const handleClick = useCallback((entry: SearchHistoryEntry) => {
    if (onSearchSelect) {
      onSearchSelect(entry.query);
    }
    logger.info('Search history item clicked', { queryLength: entry.query.length });
  }, [onSearchSelect, logger]);

  const handleStar = useCallback((entry: SearchHistoryEntry) => {
    if (onSaveSearch) {
      onSaveSearch(entry.query, entry.scope);
    }
    logger.info('Save search requested', { queryLength: entry.query.length, scope: entry.scope });
  }, [onSaveSearch, logger]);

  if (recentSearches.length === 0) {
    return null;
  }

  const displaySearches = collapsed ? recentSearches.slice(0, 2) : recentSearches;

  return (
    <div className="flex items-center gap-1" role="region" aria-label="Recent searches">
      {!collapsed && (
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Recent:
        </span>
      )}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {displaySearches.map((entry) => {
          const Icon = scopeIcons[entry.scope];

          const chip = (
            <button
              key={entry.id}
              onClick={() => handleClick(entry)}
              className={[
                'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                'bg-background border hover:bg-accent transition-colors shrink-0',
                collapsed ? 'px-1.5' : '',
              ].join(' ')}
              aria-label={`Recent search: ${entry.query}`}
            >
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate max-w-[140px]">{entry.query}</span>
                  <span className="text-[10px] text-muted-foreground/70 uppercase">
                    {scopeLabels[entry.scope]}
                  </span>
                </>
              )}
              {!collapsed && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStar(entry);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      handleStar(entry);
                    }
                  }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-yellow-500 transition-all cursor-pointer"
                  aria-label={`Save search: ${entry.query}`}
                >
                  <Star className="h-3 w-3" />
                </span>
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={entry.id}>
                <TooltipTrigger>{chip}</TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{entry.query}</p>
                  <p className="text-xs text-muted-foreground">{scopeLabels[entry.scope]}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return chip;
        })}
      </div>
    </div>
  );
});

SearchHistoryZone.displayName = 'SearchHistoryZone';
