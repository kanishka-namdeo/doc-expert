/**
 * Retrieval Eval Script
 *
 * Compares retrieval quality between `simple` and `agentic` modes.
 * Run with: node scripts/eval-retrieval.mjs
 *
 * Prerequisites:
 *   - Qdrant running at QDRANT_URL (default http://localhost:6333)
 *   - SQLite DB at DATABASE_URL (default file:./dev.db)
 *   - Documents ingested into Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { drizzle } from 'drizzle-orm/better-sqlite';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// --- Config ---
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') ?? join(rootDir, 'dev.db');
const TOP_K = 5;
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'dengcao/Qwen3-Embedding-0.6B:Q8_0';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

// --- Test Queries ---
const TEST_QUERIES = [
  'What is the authentication flow?',
  'How are documents uploaded and processed?',
  'Explain the RAG retrieval pipeline',
  'What vector store is used and why?',
  'How does session management work?',
  'What is the role-based access control system?',
  'How are embeddings generated?',
  'What chunking strategy is used?',
  'How does the chat feature work?',
  'What models are supported?',
  'How is user isolation enforced?',
  'What happens when Qdrant is unavailable?',
  'How are document versions handled?',
  'Explain the approval workflow for documents',
  'What is the parent-child chunking strategy?',
  'How does hybrid retrieval work?',
  'What is the retry strategy for failed requests?',
  'How are conversations persisted?',
  'What is the default session duration?',
  'How does the admin panel work?',
];

// --- Helpers ---
function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + text);
  console.log('='.repeat(60));
}

function printQuery(index, query) {
  console.log(`\n[Query ${index}] ${query}`);
  console.log('-'.repeat(50));
}

function printSource(idx, source) {
  const score = source.score?.toFixed(4) ?? 'N/A';
  const preview = (source.payload?.text ?? '').slice(0, 200).replace(/\s+/g, ' ');
  console.log(`  ${idx + 1}. [${score}] ${preview}...`);
  console.log(`      File: ${source.payload?.fileName ?? 'Unknown'} | Chunk: ${source.payload?.chunkIndex ?? '?'} | Doc: ${source.payload?.documentId?.slice(0, 8) ?? '?'}`);
}

// --- Main ---
async function main() {
  printHeader('Retrieval Quality Eval — Simple Mode Baseline');

  // Connect to Qdrant
  const qdrant = new QdrantClient({ url: QDRANT_URL });
  let collections;
  try {
    collections = await qdrant.getCollections();
  } catch (err) {
    console.error('Failed to connect to Qdrant:', err.message);
    console.error('Make sure Qdrant is running at', QDRANT_URL);
    process.exit(1);
  }

  const docCollection = collections.collections.find(c => c.name === 'documents');
  if (!docCollection) {
    console.error('No "documents" collection found in Qdrant.');
    console.error('Ingest some documents first, then re-run this script.');
    process.exit(1);
  }

  console.log(`Connected to Qdrant at ${QDRANT_URL}`);
  console.log(`Collection "documents": ${docCollection.points_count ?? '?'} points`);

  // Connect to SQLite
  let db;
  try {
    const sqlite = new Database(DB_PATH);
    db = drizzle(sqlite);
    console.log(`Connected to SQLite at ${DB_PATH}`);
  } catch (err) {
    console.warn('Could not connect to SQLite DB:', err.message);
    console.warn('Document metadata lookups will be unavailable.');
  }

  // Get embedding function via Ollama
  async function embed(text) {
    const res = await fetch(`${OLLAMA_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });
    if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
    const data = await res.json();
    return data.embedding;
  }

  // Run test queries
  const results = [];

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    printQuery(i + 1, query);

    try {
      const embedding = await embed(query);

      const searchResults = await qdrant.search('documents', {
        vector: embedding,
        limit: TOP_K,
        with_payload: true,
        filter: {
          must: [
            { key: 'status', match: { value: 'approved' } },
          ],
        },
      });

      if (searchResults.length === 0) {
        console.log('  (No results — collection may be empty or all points are pending)');
        results.push({ query, count: 0, sources: [] });
        continue;
      }

      console.log(`  Found ${searchResults.length} results:`);
      for (let j = 0; j < searchResults.length; j++) {
        printSource(j, searchResults[j]);
      }

      results.push({ query, count: searchResults.length, sources: searchResults });
    } catch (err) {
      console.log(`  Error: ${err.message}`);
      results.push({ query, count: 0, sources: [], error: err.message });
    }
  }

  // Summary
  printHeader('Summary');
  const totalQueries = TEST_QUERIES.length;
  const successfulQueries = results.filter(r => r.count > 0).length;
  const failedQueries = results.filter(r => r.error).length;
  const avgResults = results.reduce((s, r) => s + r.count, 0) / totalQueries;

  console.log(`Total queries:     ${totalQueries}`);
  console.log(`Successful:        ${successfulQueries}`);
  console.log(`Failed/empty:      ${failedQueries}`);
  console.log(`Avg results/query: ${avgResults.toFixed(1)}`);

  // Collect unique source documents
  const allDocs = new Map();
  for (const result of results) {
    for (const source of result.sources) {
      const docId = source.payload?.documentId;
      if (docId && !allDocs.has(docId)) {
        allDocs.set(docId, {
          fileName: source.payload?.fileName ?? 'Unknown',
          count: 0,
        });
      }
      if (docId && allDocs.has(docId)) {
        allDocs.get(docId).count++;
      }
    }
  }

  if (allDocs.size > 0) {
    console.log(`\nIndexed documents (${allDocs.size}):`);
    for (const [docId, info] of allDocs) {
      console.log(`  - ${info.fileName} (${info.count} hits)`);
    }
  }

  console.log(`
---
To compare with agentic mode:
  1. Set RETRIEVAL_MODE=agentic in your .env
  2. Start the dev server: pnpm dev
  3. Ask the same queries in the chat UI
  4. Compare the source relevance side-by-side
---`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
