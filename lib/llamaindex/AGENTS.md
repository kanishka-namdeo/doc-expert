# LlamaIndex Integration

## Purpose

LlamaIndex-based RAG (Retrieval-Augmented Generation) implementation for document ingestion, indexing, and retrieval.

## Ownership

- LlamaIndex configuration and initialization
- Document ingestion pipeline
- Vector store integration (Qdrant)
- Retrieval logic and query processing

## Local Contracts

- Configuration centralized in `config.ts`
- Document ingestion handles file parsing and chunking
- Retrieval returns relevant document chunks with metadata
- All operations use the shared LlamaIndex config from `config.ts`

## Work Guidance

### Key modules

- `config.ts` - Centralized LlamaIndex configuration (embeddings, vector store, settings)
- `documents.ts` - Document loading and preprocessing utilities
- `ingest.ts` - Pipeline for ingesting documents into the vector store
- `retriever.ts` - Query-time retrieval logic with context assembly

### Common issues

- **Duplicate import warnings**: "llamaindex was already imported" occurs when multiple files import from llamaindex packages. This is a known library behavior and non-blocking — the build succeeds and runtime works correctly.
- **Qdrant connection**: Ensure Qdrant service is running before ingestion or retrieval operations
- **Embedding model**: Configured in `config.ts`; verify model availability if using local models

## Subagent Delegation

Use `rag-specialist` subagent for all work in this directory. It owns LlamaIndex pipeline knowledge, Qdrant operations, embedding config, and document loader specifics.

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test ingestion with sample documents
- Verify retrieval returns relevant results for test queries

## Child DOX Index

- `loaders/` - Document format-specific loaders (PDF, DOCX, Markdown)
