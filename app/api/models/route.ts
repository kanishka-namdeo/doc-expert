import { NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { STREAMLAKE_MODELS } from '@/lib/ai/provider';

const logger = getLogger('api/models');

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
    context_length: number;
    embedding_length: number;
  };
  capabilities: string[];
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
  let chatModels: OllamaModel[] = [];
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    
    if (response.ok) {
      const data = (await response.json()) as OllamaTagsResponse;
      // Filter to only completion-capable models (exclude embedding-only models)
      chatModels = data.models.filter(model => 
        model.capabilities.includes('completion')
      );
    } else {
      logger.warn({ status: response.status }, 'Ollama not available, using StreamLake models only');
    }
  } catch (error) {
    logger.error({ err: error }, 'Ollama connection failed, using StreamLake models only');
  }

  // Merge Ollama chat models with static StreamLake models
  const streamlakeModels = STREAMLAKE_MODELS.map(modelId => ({
    name: modelId,
    model: modelId,
    modified_at: new Date().toISOString(),
    size: 0,
    digest: '',
    details: {
      parent_model: '',
      format: 'custom',
      family: 'streamlake',
      families: ['streamlake'],
      parameter_size: 'unknown',
      quantization_level: 'unknown',
      context_length: 0,
      embedding_length: 0,
    },
    capabilities: ['completion'],
  }));

  const allModels = [...chatModels, ...streamlakeModels];
  
  if (allModels.length === 0) {
    logger.warn({}, 'No models available from any provider');
  }

  return NextResponse.json({ models: allModels });
}
