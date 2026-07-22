'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSavedSearches } from '@/hooks/use-saved-searches';
import { useLogger } from '@/hooks/use-logger';
import type { SearchScope } from '@/components/command-palette/scope-filter';

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  scope: SearchScope;
}

export function SaveSearchDialog({
  open,
  onOpenChange,
  query,
  scope,
}: SaveSearchDialogProps) {
  const logger = useLogger('save-search-dialog');
  const { save, savedSearches } = useSavedSearches();
  const [label, setLabel] = useState('');

  const isDuplicate = savedSearches.some(
    (s) => s.query === query && s.scope === scope
  );

  const handleSave = () => {
    if (!query.trim()) {
      logger.warn('Attempted to save empty search query');
      return;
    }

    save(query, scope, label.trim() || undefined);
    logger.info('Search saved from dialog', { query, scope, label });
    setLabel('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setLabel('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Save Search Dialog">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save this search for quick access later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Query
            </label>
            <div className="rounded-md bg-muted px-2 py-1.5 text-sm">
              {query}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Scope
            </label>
            <div className="rounded-md bg-muted px-2 py-1.5 text-sm capitalize">
              {scope}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="save-search-label"
              className="text-xs font-medium text-muted-foreground"
            >
              Label (optional)
            </label>
            <Input
              id="save-search-label"
              placeholder="e.g. Weekly reports"
              value={label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLabel(e.target.value)
              }
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {isDuplicate && (
            <p className="text-xs text-muted-foreground">
              This search is already saved.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!query.trim() || isDuplicate}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
