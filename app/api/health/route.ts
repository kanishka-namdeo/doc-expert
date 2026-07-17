import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/health');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.1:8b';

async function checkQdrant(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    const response = await fetch(`${QDRANT_URL}/collections`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;

    if (response.ok) {
      return { status: 'healthy', latency };
    }
    return { status: 'degraded', error: `HTTP ${response.status}` };
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkDatabase(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    const { db } = await import('@/lib/db');
    const { sql } = await import('drizzle-orm');
    await db.select({ count: sql`count(*)` }).from(sql`user`);
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkLLM(): Promise<{ status: string; model?: string; error?: string }> {
  // Check if Ollama is available
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const start = Date.now();
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;

    if (response.ok) {
      return { status: 'healthy', model: LLM_MODEL };
    }
    return { status: 'degraded', model: LLM_MODEL, error: `HTTP ${response.status}` };
  } catch (error) {
    return { status: 'unhealthy', model: LLM_MODEL, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const [qdrant, database, llm] = await Promise.all([
      checkQdrant(),
      checkDatabase(),
      checkLLM(),
    ]);

    const overallStatus =
      qdrant.status === 'unhealthy' || database.status === 'unhealthy' || llm.status === 'unhealthy'
        ? 'unhealthy'
        : qdrant.status === 'degraded' || llm.status === 'degraded'
          ? 'degraded'
          : 'healthy';

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        qdrant,
        database,
        llm,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    return NextResponse.json(
      { status: 'unhealthy', error: 'Health check failed' },
      { status: 503 }
    );
  }
}
