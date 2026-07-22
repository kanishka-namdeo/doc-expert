'use client';

import { useState, useCallback, memo } from 'react';
import { Bookmark, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSavedSearches } from '@/hooks/use-saved-searches';
import { useLogger } from '@/hooks/use-logger';
import type { SavedSearch } from '@/hooks/use-saved-searches';

interface SavedSearchesZoneProps {
  collapsed: boolean;
  onSearchSelect?: (query: string, scope: string) => void;
}

export const SavedSearchesZone = memo(function SavedSearchesZone({ collapsed, onSearchSelect }: SavedSearchesZoneProps) {
  const logger = useLogger('saved-searches-zone');
  const { savedSearches, remove } = useSavedSearches();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClick = useCallback(
    (search: SavedSearch) => {
      if (onSearchSelect) {
        onSearchSelect(search.query, search.scope);
      }
      logger.info('Saved search clicked', { queryLength: search.query.length });
    },
    [onSearchSelect, logger]
  );

  const handleRemove = useCallback(
    (search: SavedSearch) => {
      remove(search.id);
      logger.info('Saved search removed', { id: search.id });
    },
    [remove, logger]
  );

  if (savedSearches.length === 0) {
    return null;
  }

  const displaySearches = collapsed ? savedSearches.slice(0, 2) : savedSearches;

  return (
    <div className="flex items-center gap-1" role="region" aria-label="Saved searches">
      {!collapsed && (
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1 flex items-center gap-1">
          <Bookmark className="h-3 w-3" />
          Saved:
        </span>
      )}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {displaySearches.map((search) => {
          const chip = (
            <button
              key={search.id}
              onClick={() => handleClick(search)}
              onMouseEnter={() => setHoveredId(search.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={[
                'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                'bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors shrink-0',
                collapsed ? 'px-1.5' : '',
              ].join(' ')}
              aria-label={`Saved search: ${search.label || search.query}`}
            >
              <Bookmark className="h-3 w-3 text-primary shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate max-w-[140px]">
                    {search.label || search.query}
                  </span>
                  {hoveredId === search.id && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(search);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          handleRemove(search);
                        }
                      }}
                      className="ml-0.5 hover:text-destructive transition-all cursor-pointer"
                      aria-label={`Remove saved search: ${search.label || search.query}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </>
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={search.id}>
                <TooltipTrigger>{chip}</TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">{search.label || search.query}</p>
                  {search.label && (
                    <p className="text-xs text-muted-foreground">{search.query}</p>
                  )}
                  <p className="text-xs text-muted-foreground capitalize">{search.scope}</p>
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

SavedSearchesZone.displayName = 'SavedSearchesZone';
