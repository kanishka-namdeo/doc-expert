/**
 * Smoke test for the retrieval quality overhaul.
 * Tests each retrieval mode (simple, layered, agentic) by importing
 * the modules directly and exercising them against Qdrant.
 *
 * Run with: node scripts/smoke-test-retrieval.mjs
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createOllama } from 'ollama-ai-provider-v2';
import { embed } from 'ai';

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'dengcao/Qwen3-Embedding-0.6B:Q8_0';

const ollama = createOllama({ baseURL: OLLAMA_URL + '/api' });

function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + text);
  console.log('='.repeat(60));
}

async function checkQdrant() {
  printHeader('Checking Qdrant connectivity');
  const client = new QdrantClient({ url: QDRANT_URL });
  try {
    const collections = await client.getCollections();
    const docCol = collections.collections.find(c => c.name === 'documents');
    if (!docCol) {
      console.log('  WARNING: No "documents" collection in Qdrant. Retrieval will return empty results.');
      console.log('  Ingest a document first, then re-run this test.');
      return { client, hasData: false };
    }
    console.log(`  Connected. Collection "documents" has ${docCol.points_count ?? '?'} points.`);
    return { client, hasData: true };
  } catch (err) {
    console.log(`  ERROR: Cannot connect to Qdrant at ${QDRANT_URL}: ${err.message}`);
    return { client: null, hasData: false };
  }
}

async function testEmbedding() {
  printHeader('Testing embedding generation');
  try {
    const { embedding } = await embed({
      model: ollama.embedding(EMBED_MODEL),
      value: 'test query for smoke test',
    });
    console.log(`  OK: Generated embedding with ${embedding.length} dimensions`);
    return true;
  } catch (err) {
    console.log(`  ERROR: Embedding failed: ${err.message}`);
    console.log('  Make sure Ollama is running and the embedding model is pulled.');
    return false;
  }
}

async function testSimpleMode() {
  printHeader('Testing simple mode (baseline dense search)');
  try {
    // Dynamically import to pick up current RETRIEVAL_MODE
    const { retrieveContext } = await import('../lib/llamaindex/retriever.ts');
    const result = await retrieveContext('test query', 3, 'dev-user');
    console.log(`  Sources found: ${result.sources.length}`);
    if (result.sources.length > 0) {
      console.log(`  Top source: ${result.sources[0].text.slice(0, 100)}...`);
      console.log(`  File: ${result.sources[0].fileName}`);
    } else {
      console.log('  (No sources — Qdrant may be empty or all points are pending)');
    }
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(err.stack?.split('\n').slice(0, 5).join('\n'));
    return false;
  }
}

async function testLayeredMode() {
  printHeader('Testing layered mode (multi-query + hybrid fusion + context assembly)');
  try {
    const { hybridRetrieve } = await import('../lib/llamaindex/hybrid-retriever.ts');
    const results = await hybridRetrieve(['test query', 'test'], 3, { userId: 'dev-user' });
    console.log(`  Hybrid results: ${results.length} candidates`);
    if (results.length > 0) {
      console.log(`  Top candidate: ${results[0].text.slice(0, 100)}...`);
      console.log(`  Score: ${results[0].score.toFixed(4)}`);
      console.log(`  Has parentId: ${!!results[0].parentId}`);
    }
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(err.stack?.split('\n').slice(0, 5).join('\n'));
    return false;
  }
}

async function testAgenticMode() {
  printHeader('Testing agentic mode (query planner + hybrid + rerank + assemble)');
  try {
    const { planQuery } = await import('../lib/llamaindex/query-planner.ts');
    const plan = await planQuery('What is the embedding model?');
    console.log(`  Query plan: ${plan.queries.length} queries, mode=${plan.searchMode}`);
    console.log(`  Queries: ${plan.queries.map(q => `"${q.slice(0, 50)}"`).join(', ')}`);
    if (plan.followUpQueries) {
      console.log(`  Follow-ups: ${plan.followUpQueries.length}`);
    }
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(err.stack?.split('\n').slice(0, 5).join('\n'));
    return false;
  }
}

async function testReranker() {
  printHeader('Testing reranker module');
  try {
    const { rerankCandidates } = await import('../lib/llamaindex/reranker.ts');
    // Create mock candidates
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      id: `mock-${i}`,
      text: `This is mock chunk ${i} with some test content about embeddings and retrieval.`,
      fileName: 'test.md',
      uploadedAt: new Date().toISOString(),
      documentId: 'mock-doc',
      userId: 'dev-user',
      chunkIndex: i,
      score: 0.9 - i * 0.1,
    }));
    const reranked = await rerankCandidates('test query about embeddings', candidates);
    console.log(`  Reranked: ${candidates.length} -> ${reranked.length} results`);
    if (reranked.length > 0) {
      console.log(`  Top score: ${reranked[0].score.toFixed(4)}`);
    }
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(err.stack?.split('\n').slice(0, 5).join('\n'));
    return false;
  }
}

async function testContextAssembler() {
  printHeader('Testing context assembler');
  try {
    const { assembleContext } = await import('../lib/llamaindex/context-assembler.ts');
    // Create mock candidates with parent-child relationships
    const candidates = [
      {
        id: 'child-1',
        text: 'This is a child chunk about embeddings.',
        fileName: 'test.md',
        uploadedAt: new Date().toISOString(),
        documentId: 'mock-doc',
        userId: 'dev-user',
        chunkIndex: 0,
        score: 0.9,
        parentId: 'parent-1',
        isParent: false,
        siblingIndex: 0,
      },
    ];
    const assembled = await assembleContext(candidates);
    console.log(`  Assembled context length: ${assembled.context.length} chars`);
    console.log(`  Sources: ${assembled.sources.length}`);
    return true;
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log(err.stack?.split('\n').slice(0, 5).join('\n'));
    return false;
  }
}

async function main() {
  printHeader('Retrieval Quality Overhaul — Smoke Test');
  console.log(`  RETRIEVAL_MODE: ${process.env.RETRIEVAL_MODE ?? 'simple'}`);
  console.log(`  QDRANT_URL: ${QDRANT_URL}`);
  console.log(`  OLLAMA_URL: ${OLLAMA_URL}`);

  const results = { passed: 0, failed: 0, skipped: 0 };

  // Test 1: Qdrant connectivity
  const { hasData } = await checkQdrant();
  if (!hasData) {
    console.log('\n  Skipping retrieval tests — no data in Qdrant.');
    console.log('  Ingest a document first, then re-run.');
  }

  // Test 2: Embedding
  const embedOk = await testEmbedding();
  if (embedOk) results.passed++; else results.failed++;

  // Test 3: Simple mode
  if (hasData && embedOk) {
    const ok = await testSimpleMode();
    if (ok) results.passed++; else results.failed++;
  } else {
    console.log('\n  SKIPPED: simple mode test');
    results.skipped++;
  }

  // Test 4: Layered mode (hybrid retriever)
  if (hasData && embedOk) {
    const ok = await testLayeredMode();
    if (ok) results.passed++; else results.failed++;
  } else {
    console.log('\n  SKIPPED: layered mode test');
    results.skipped++;
  }

  // Test 5: Agentic mode (query planner)
  const ok5 = await testAgenticMode();
  if (ok5) results.passed++; else results.failed++;

  // Test 6: Reranker
  const ok6 = await testReranker();
  if (ok6) results.passed++; else results.failed++;

  // Test 7: Context assembler
  const ok7 = await testContextAssembler();
  if (ok7) results.passed++; else results.failed++;

  // Summary
  printHeader('Smoke Test Summary');
  console.log(`  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);

  if (results.failed > 0) {
    console.log('\n  Some tests failed. Check the errors above.');
    process.exit(1);
  } else {
    console.log('\n  All tests passed!');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
