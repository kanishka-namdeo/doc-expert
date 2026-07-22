'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { FolderOpen, Bot, X, Bookmark, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLogger } from '@/hooks/use-logger';
import { useContextPresets } from '@/hooks/use-context-presets';

const COLLECTION_STORAGE_KEY = 'doc-expert:context-collection';
const MODEL_STORAGE_KEY = 'doc-expert:model-preference';

interface ContextZoneProps {
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  collapsed: boolean;
}

interface ModelOption {
  id: string;
  name: string;
}

export const ContextZone = memo(function ContextZone({
  selectedCollectionId,
  setSelectedCollectionId,
  selectedModel,
  setSelectedModel,
  collapsed,
}: ContextZoneProps) {
  const logger = useLogger('context-zone');
  const { presets, savePreset, loadPreset } = useContextPresets();
  const [collectionName, setCollectionName] = useState<string>('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');

  useEffect(() => {
    async function fetchCollection() {
      if (!selectedCollectionId) {
        setCollectionName('');
        return;
      }
      try {
        const res = await fetch(`/api/collections/${selectedCollectionId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCollectionName(data.name);
        }
      } catch {
        // Ignore errors
      }
    }
    fetchCollection();
  }, [selectedCollectionId]);

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/admin/models', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const modelList = (data.models || []) as Array<{ id?: string; name?: string; digest?: string }>;
          setModels(
            modelList.map((m) => ({
              id: m.id || m.digest || m.name || '',
              name: m.name || m.id || m.digest || '',
            }))
          );
        }
      } catch {
        // Ignore errors
      }
    }
    fetchModels();
  }, []);

  const handleClearCollection = useCallback(() => {
    setSelectedCollectionId(null);
    try {
      localStorage.removeItem(COLLECTION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    logger.info('Collection context cleared');
  }, [setSelectedCollectionId, logger]);

  const handleClearAll = useCallback(() => {
    setSelectedCollectionId(null);
    setSelectedModel('');
    try {
      localStorage.removeItem(COLLECTION_STORAGE_KEY);
      localStorage.removeItem(MODEL_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    logger.info('All context cleared');
  }, [setSelectedCollectionId, setSelectedModel, logger]);

  const handleSavePreset = useCallback(() => {
    setPresetLabel('');
    setShowSaveDialog(true);
  }, []);

  const handleConfirmSavePreset = useCallback(() => {
    if (!presetLabel.trim()) return;
    savePreset(presetLabel.trim(), selectedModel, selectedCollectionId);
    setShowSaveDialog(false);
    setPresetLabel('');
    logger.info('Context preset saved from UI', { label: presetLabel.trim() });
  }, [presetLabel, savePreset, selectedModel, selectedCollectionId, logger]);

  const handleLoadPreset = useCallback(
    (id: string) => {
      const preset = loadPreset(id);
      if (!preset) return;
      setSelectedModel(preset.modelId);
      setSelectedCollectionId(preset.collectionId);
      try {
        if (preset.modelId) {
          localStorage.setItem(MODEL_STORAGE_KEY, preset.modelId);
        }
        if (preset.collectionId) {
          localStorage.setItem(COLLECTION_STORAGE_KEY, preset.collectionId);
        } else {
          localStorage.removeItem(COLLECTION_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      logger.info('Context preset loaded', { id: preset.id, label: preset.label });
    },
    [loadPreset, setSelectedModel, setSelectedCollectionId, logger]
  );

  const hasContext = !!selectedCollectionId || !!selectedModel;

  if (!hasContext && !selectedCollectionId) {
    return null;
  }

  return (
    <div className="flex items-center gap-1" role="region" aria-label="Context controls">
      {!collapsed && (
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">Context:</span>
      )}

      <div className="flex items-center gap-1">
        {selectedCollectionId && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1 px-1.5 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                  <FolderOpen className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{collectionName || 'Loading...'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
              <FolderOpen className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[120px]">{collectionName || 'Loading...'}</span>
              <button
                onClick={handleClearCollection}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label="Clear collection"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        )}

        {selectedModel && (
          collapsed ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-1.5 py-1 bg-background border rounded-md text-xs font-medium hover:bg-accent transition-colors">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{selectedModel}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                {models.length === 0 ? (
                  <DropdownMenuItem disabled>No models available</DropdownMenuItem>
                ) : (
                  models.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={model.id === selectedModel ? 'bg-accent' : ''}
                    >
                      {model.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 py-1 bg-background border rounded-md text-xs font-medium hover:bg-accent transition-colors">
                  <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[100px]">{selectedModel}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {models.length === 0 ? (
                  <DropdownMenuItem disabled>No models available</DropdownMenuItem>
                ) : (
                  models.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={model.id === selectedModel ? 'bg-accent' : ''}
                    >
                      {model.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}

        {hasContext && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger>
                <DropdownMenuTrigger asChild>
                  <button
                    className={
                      collapsed
                        ? 'flex items-center gap-1 px-1.5 py-1 bg-background border rounded-md text-xs font-medium hover:bg-accent transition-colors'
                        : 'flex items-center gap-1.5 px-2 py-1 bg-background border rounded-md text-xs font-medium hover:bg-accent transition-colors'
                    }
                    aria-label="Presets"
                  >
                    <Bookmark className={collapsed ? 'h-3 w-3' : 'h-3 w-3 shrink-0'} />
                    {!collapsed && <span>Presets</span>}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Context presets</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {presets.length === 0 ? (
                <DropdownMenuItem disabled>No presets saved</DropdownMenuItem>
              ) : (
                presets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset.id)}
                  >
                    <Bookmark className="h-3 w-3 mr-2" />
                    {preset.label}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSavePreset}>
                <Save className="h-3 w-3 mr-2" />
                Save current as preset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasContext && !collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
          >
            Clear all
          </Button>
        )}
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Context Preset</DialogTitle>
            <DialogDescription>
              Save the current model and collection as a preset for quick switching.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Preset name (e.g., Quick Analysis)"
              value={presetLabel}
              onChange={(e) => setPresetLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmSavePreset();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSavePreset} disabled={!presetLabel.trim()}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ContextZone.displayName = 'ContextZone';
