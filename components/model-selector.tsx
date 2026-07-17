'use client';

import { useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const logger = getLogger('model-selector');

interface Model {
  name: string;
  model: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

function isLocalModel(model: Model): boolean {
  return !model.details?.family || model.details.family !== 'streamlake';
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        setModels(data.models || []);
      } catch (error) {
        logger.error({ err: error }, 'Failed to fetch available models');
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Loading models...
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        No models available
      </div>
    );
  }

  const localModels = models.filter(isLocalModel);
  const cloudModels = models.filter((m) => !isLocalModel(m));

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="model-select" className="text-sm text-muted-foreground">
        Model:
      </label>
      <Select value={value} onValueChange={(val) => onChange(val as string)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {localModels.length > 0 && (
            <SelectItem value="local-header" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              — Local (Ollama) —
            </SelectItem>
          )}
          {localModels.map((model) => (
            <SelectItem key={model.model} value={model.model}>
              {model.name}
              {model.details?.parameter_size && ` (${model.details.parameter_size})`}
            </SelectItem>
          ))}
          {cloudModels.length > 0 && (
            <SelectItem value="cloud-header" disabled className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              — Cloud —
            </SelectItem>
          )}
          {cloudModels.map((model) => (
            <SelectItem key={model.model} value={model.model}>
              {model.name}
              {model.details?.parameter_size && ` (${model.details.parameter_size})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
