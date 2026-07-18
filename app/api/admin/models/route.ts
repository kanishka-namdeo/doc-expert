import { requireAdmin } from '@/lib/auth/rbac';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const logger = getLogger('api/admin/models');

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

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    let chatModels: OllamaModel[] = [];

    if (response.ok) {
      const data = (await response.json()) as OllamaTagsResponse;
      chatModels = data.models.filter((model) =>
        model.capabilities.includes('completion')
      );
    }

    return NextResponse.json({ models: chatModels });
  } catch (error) {
    logger.warn({ err: error }, 'Ollama not available, returning empty model list');
    return NextResponse.json({ models: [] });
  }
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const bodySchema = z.object({
      name: z.string().min(1),
    });
    const parsed = bodySchema.parse(await request.json());
    const { name: modelName } = parsed;

    const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';

    const ollamaResponse = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      return NextResponse.json({ error: `Ollama pull failed: ${errText}` }, { status: ollamaResponse.status });
    }

    // Pipe the SSE stream through to the client
    const reader = ollamaResponse.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: 'No response body from Ollama' }, { status: 500 });
    }

    const stream = new ReadableStream({
      async pull(controller) {
        const decoder = new TextDecoder();
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(new TextEncoder().encode(line + '\n'));
            }
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.releaseLock();
      },
    });

    await logAuditEvent(
      adminResult.user.id,
      'model.pull',
      'models',
      { modelName }
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to pull model');
    return NextResponse.json({ error: 'Failed to pull model' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const bodySchema = z.object({
      name: z.string().min(1),
    });
    const parsed = bodySchema.parse(await request.json());
    const { name: modelName } = parsed;

    const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';

    const ollamaResponse = await fetch(`${ollamaUrl}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      return NextResponse.json({ error: `Ollama delete failed: ${errText}` }, { status: ollamaResponse.status });
    }

    await logAuditEvent(
      adminResult.user.id,
      'model.delete',
      'models',
      { modelName }
    );

    logger.info({ modelName }, 'Model deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to delete model');
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}
