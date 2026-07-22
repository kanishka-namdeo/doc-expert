'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Pin,
  Search,
  Bookmark,
  BookmarkCheck,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
import { usePinning } from '@/hooks/use-pinning';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useSavedSearches } from '@/hooks/use-saved-searches';
import { useContextPresets } from '@/hooks/use-context-presets';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { toast } from 'sonner';

export default function PreferencesPage() {
  const logger = useLogger('settings/preferences');
  const { pinnedItems, clearAll: clearPinned } = usePinning();
  const { history, clearHistory } = useSearchHistory();
  const { savedSearches, clear: clearSavedSearches } = useSavedSearches();
  const { presets, clearAll: clearPresets } = useContextPresets();

  const [showClearPinned, setShowClearPinned] = useState(false);
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [showClearSavedSearches, setShowClearSavedSearches] = useState(false);
  const [showClearPresets, setShowClearPresets] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);

  const handleClearPinned = async () => {
    clearPinned();
    logger.info('Pinned items cleared from settings');
    toast.success('Pinned items cleared');
    setShowClearPinned(false);
  };

  const handleClearHistory = async () => {
    clearHistory();
    logger.info('Search history cleared from settings');
    toast.success('Search history cleared');
    setShowClearHistory(false);
  };

  const handleClearSavedSearches = async () => {
    clearSavedSearches();
    logger.info('Saved searches cleared from settings');
    toast.success('Saved searches cleared');
    setShowClearSavedSearches(false);
  };

  const handleClearPresets = async () => {
    clearPresets();
    logger.info('Context presets cleared from settings');
    toast.success('Context presets cleared');
    setShowClearPresets(false);
  };

  const handleResetAll = async () => {
    clearPinned();
    clearHistory();
    clearSavedSearches();
    clearPresets();
    logger.info('All preferences reset from settings');
    toast.success('All preferences reset');
    setShowResetAll(false);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Preferences"
        description="Manage your power user preferences and clear stored data."
        actions={
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowResetAll(true)}
            disabled={
              pinnedItems.length === 0 &&
              history.length === 0 &&
              savedSearches.length === 0 &&
              presets.length === 0
            }
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset all preferences
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2" aria-hidden="true">
                    <Pin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Pinned Items</CardTitle>
                    <CardDescription>
                      Items you&apos;ve pinned for quick access
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {pinnedItems.length} {pinnedItems.length === 1 ? 'item' : 'items'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearPinned(true)}
                disabled={pinnedItems.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all pinned items
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2" aria-hidden="true">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Search History</CardTitle>
                    <CardDescription>
                      Your recent search queries
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {history.length} {history.length === 1 ? 'entry' : 'entries'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearHistory(true)}
                disabled={history.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear search history
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2" aria-hidden="true">
                    <Bookmark className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Saved Searches</CardTitle>
                    <CardDescription>
                      Searches you&apos;ve saved for quick access
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {savedSearches.length} {savedSearches.length === 1 ? 'search' : 'searches'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearSavedSearches(true)}
                disabled={savedSearches.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear saved searches
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2" aria-hidden="true">
                    <BookmarkCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Context Presets</CardTitle>
                    <CardDescription>
                      Saved model and collection combinations
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {presets.length} {presets.length === 1 ? 'preset' : 'presets'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearPresets(true)}
                disabled={presets.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all presets
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showClearPinned}
        onOpenChange={setShowClearPinned}
        title="Clear pinned items?"
        description="This will remove all pinned items. This action cannot be undone."
        confirmLabel="Clear all"
        confirmVariant="destructive"
        onConfirm={handleClearPinned}
      />

      <ConfirmDialog
        open={showClearHistory}
        onOpenChange={setShowClearHistory}
        title="Clear search history?"
        description="This will remove all search history. This action cannot be undone."
        confirmLabel="Clear all"
        confirmVariant="destructive"
        onConfirm={handleClearHistory}
      />

      <ConfirmDialog
        open={showClearSavedSearches}
        onOpenChange={setShowClearSavedSearches}
        title="Clear saved searches?"
        description="This will remove all saved searches. This action cannot be undone."
        confirmLabel="Clear all"
        confirmVariant="destructive"
        onConfirm={handleClearSavedSearches}
      />

      <ConfirmDialog
        open={showClearPresets}
        onOpenChange={setShowClearPresets}
        title="Clear context presets?"
        description="This will remove all context presets. This action cannot be undone."
        confirmLabel="Clear all"
        confirmVariant="destructive"
        onConfirm={handleClearPresets}
      />

      <ConfirmDialog
        open={showResetAll}
        onOpenChange={setShowResetAll}
        title="Reset all preferences?"
        description="This will clear all pinned items, search history, saved searches, and context presets. This action cannot be undone."
        confirmLabel="Reset all"
        confirmVariant="destructive"
        onConfirm={handleResetAll}
      />
    </div>
  );
}
