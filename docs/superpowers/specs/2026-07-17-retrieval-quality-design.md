# Retrieval Quality Overhaul — Design Specification

**Date:** 2026-07-17
**Status:** Draft
**Author:** Doc Expert Team

## 1. Problem Statement

The current RAG retrieval pipeline has four interrelated quality problems:

1. **Recall failures** — relevant documents exist but are not found (single embedding, single query)
2. **Precision failures** — irrelevant chunks rank above useful ones (no re-ranking)
3. **Context fragmentation** — correct content split across chunks, giving the LLM broken context (fixed 512-token chunks, no parent-child relationship)
4. **Query understanding gaps** — user queries are not transformed or expanded before search (raw query → embedding)

## 2. Solution Overview

A two-phase retrieval pipeline combining agentic query planning with layered retrieval execution:

- **Phase 1 — Agentic Query Planning:** An LLM analyzes the user query and conversation history to produce a structured search plan with multiple query variants, a confidence signal, and optional follow-up queries.
- **Phase 2 — Layered Retrieval Execution:** The search plan drives a modular pipeline of dense search, hybrid fusion, LLM self-reranking, and parent-child context assembly.

Each layer is independently toggleable via configuration, allowing gradual rollout and A/B comparison against the existing `simple` mode.

## 3. Architecture

### 3.1 Phase 1 — Agentic Query Planning

**Module:** `lib/llamaindex/query-planner.ts`

The query planner receives the user's raw query and recent conversation history (last 3 messages). It calls the LLM with a structured prompt requesting a JSON search plan:

```json
{
  "queries": ["query variant 1", "query variant 2", "query variant 3"],
  "searchMode": "broad",
  "followUpQueries": ["optional refinement if initial results are sparse"]
}
```

Query variants include:
- The original query (always included)
- A decomposed version (breaking multi-part questions into sub-questions)
- A synonym/abbreviation-expanded version
- A HyDE-style hypothetical answer (the LLM imagines what a relevant document might say)

The `searchMode` signal (`broad` or `narrow`) controls how many candidates to fetch and how aggressively to fuse results.

**Fallback:** If the LLM times out or returns malformed JSON, the planner returns `{ queries: [originalQuery], searchMode: "narrow" }` and logs a warning.

### 3.2 Phase 2 — Layered Retrieval Execution

#### 3.2.1 Hybrid Retriever

**Module:** `lib/llamaindex/hybrid-retriever.ts`

Executes dense and sparse searches in parallel:

- **Dense search:** Each query variant from the search plan is embedded and searched in Qdrant. Results are merged with deduplication by point ID, keeping the highest score per point.
- **Sparse search (BM25):** A lightweight in-memory inverted index is built lazily from the top-200 dense candidates. BM25 scoring runs over this index. This avoids storing sparse vectors in Qdrant and avoids a separate search infrastructure.
- **Reciprocal Rank Fusion (RRF):** Merged results are scored as:
  ```
  score = 1 / (k + rank_dense) + 1 / (k + rank_sparse)
  ```
  Default `k = 60`. Points appearing in only one list get a partial score from that list alone.

**Fallback:** If BM25 produces fewer than 10 results (index too small), fusion is skipped and dense-only results are used.

#### 3.2.2 LLM Self-Reranker

**Module:** `lib/llamaindex/reranker.ts`

Takes the top-30 fused candidates and the original query. Makes a single batched LLM call requesting relevance scores (0.0–1.0) for each chunk. The prompt instructs the LLM to return a JSON array of `{ index, score }` pairs.

Chunks scoring below 0.3 are filtered out. The remaining chunks are sorted by score descending and truncated to the top 5–8.

**Fallback:** If the LLM call fails or returns unparseable output, the pipeline falls back to the dense-score ordering from the hybrid retriever.

#### 3.2.3 Context Assembler

**Module:** `lib/llamaindex/context-assembler.ts`

Manages parent-child chunk relationships:

- **During ingestion:** Each document is split into parent chunks (~1024 tokens). Each parent is then split into child chunks (~256 tokens with 32-token overlap). Child chunks are stored in Qdrant with a `parentId` metadata field pointing to their parent.
- **During retrieval:** When a child chunk matches, the assembler fetches the parent chunk and adjacent siblings (one before, one after if they exist). This provides the LLM with full narrative context around the matched span.
- **Deduplication:** Parent chunks are deduplicated by ID. Chunks are ordered by their original position in the document to preserve flow.

**Fallback:** If a parent chunk cannot be found (deleted or missing metadata), the child chunk is returned as-is.

### 3.3 Orchestrator

**Module:** `lib/llamaindex/retriever.ts` (modified)

The existing `retrieveContext()` function becomes the pipeline orchestrator. It calls each layer in sequence:

```
query → queryPlanner → hybridRetriever → reranker → contextAssembler → context string
```

The function signature remains unchanged for backward compatibility with the chat route.

## 4. Configuration

New environment variables:

| Variable | Default | Description |
|---|---|---|
| `RETRIEVAL_MODE` | `simple` | `simple` (current behavior), `layered` (dense + hybrid), or `agentic` (full pipeline) |
| `RERANK_MODEL` | (uses default LLM) | Model to use for reranking; can be a cheaper model than the chat model |
| `HYBRID_FUSION_K` | `60` | RRF constant; lower values weight top ranks more heavily |
| `PARENT_CHUNK_SIZE` | `1024` | Parent chunk token size during ingestion |
| `CHILD_CHUNK_SIZE` | `256` | Child chunk token size for search |
| `CHILD_CHUNK_OVERLAP` | `32` | Overlap between child chunks |
| `RETRIEVAL_TIMEOUT_MS` | `15000` | Total pipeline timeout; partial results returned if exceeded |

## 5. Error Handling

Each layer has an independent fallback:

| Layer | Failure | Fallback |
|---|---|---|
| Query Planner | LLM timeout / malformed JSON | Return original query as single-element list |
| Hybrid Retriever | BM25 index empty | Dense-only retrieval |
| Reranker | LLM timeout / parse failure | Dense-score ordering |
| Context Assembler | Parent chunk not found | Return child chunk as-is |
| Full pipeline | Total timeout exceeded | Return partial results with warning flag |

All failures are logged with structured fields: `layer`, `error`, `fallback`, `queryLength`, `userId`.

## 6. Testing Strategy

### 6.1 Unit Tests

- **Query planner:** Mock LLM response; verify JSON parsing; verify fallback on malformed output
- **Hybrid retriever:** Verify RRF fusion scoring with known rank inputs; verify deduplication
- **Reranker:** Verify score parsing; verify fallback on LLM failure
- **Context assembler:** Verify parent-child lookup; verify neighbor expansion; verify deduplication

### 6.2 Integration Tests

- Seed a small document set (5–10 docs with known content)
- Run queries with known answers; verify correct documents appear in top results
- Compare `simple` vs `agentic` mode on the same queries

### 6.3 Evaluation Script

`scripts/eval-retrieval.mjs` — runs ~20 test queries against both modes and prints side-by-side results (top-5 chunks, scores, source documents). Manual review determines quality improvement.

## 7. Implementation Plan

The work breaks into these independent pieces:

1. **Parent-child chunking in ingestion** — Modify `ingest.ts` to create parent chunks and tag children with `parentId`. Requires re-ingesting existing documents.
2. **Query planner module** — New `query-planner.ts` with LLM prompt and JSON parsing.
3. **Hybrid retriever module** — New `hybrid-retriever.ts` with BM25 index and RRF fusion.
4. **LLM reranker module** — New `reranker.ts` with batched scoring prompt.
5. **Context assembler module** — New `context-assembler.ts` with parent lookup and neighbor expansion.
6. **Orchestrator integration** — Modify `retriever.ts` to wire the pipeline together.
7. **Configuration and feature flags** — Add env vars and mode switching.
8. **Evaluation script and test documents** — Add `scripts/eval-retrieval.mjs` and seed test corpus.

## 8. Out of Scope

- Changing the embedding model (can be done later; the pipeline is model-agnostic)
- Storing sparse vectors in Qdrant (BM25 is in-memory, built lazily)
- Automated eval harness with ground-truth labels (manual eval script is sufficient for now)
- Multi-tenancy or team workspace changes (separate concern)
