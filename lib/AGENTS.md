# Lib Directory

## Purpose

Shared utility functions and library code used across the application.

## Ownership

- Utility functions (e.g., `cn()` for class merging)
- Helper modules and shared logic
- Third-party library wrappers

## Local Contracts

- All exports must be typed with TypeScript
- Functions should be pure when possible
- Document complex utilities with JSDoc comments

## Work Guidance

- Keep utilities focused and single-purpose
- Prefer small, composable functions over large monolithic ones
- Export named functions, not default exports
- Include type definitions for all parameters and return values

## Subagent Delegation

This directory contains multiple specialist areas. Use the appropriate subagent based on the work:
- `lib/llamaindex/` → `rag-specialist`
- `lib/auth/` → `auth-specialist`
- `lib/db/` → `database-specialist`

For utilities in `lib/` root (utils.ts, logger.ts, types.ts, etc.), no specific subagent is required.

## Verification

- Run `pnpm typecheck` to ensure type safety
- Run `pnpm lint` to check code quality

## Child DOX Index

- `ai/` - AI provider configuration and tool definitions
- `auth/` - Better Auth authentication, RBAC, and session monitoring
- `connectors/` - Multi-source document connector framework (Google Drive, Microsoft 365)
- `db/` - Database schema and Drizzle ORM configuration
- `graphql/` - GraphQL schema definitions and resolver context
- `llamaindex/` - LlamaIndex RAG implementation (ingestion, retrieval, vector store)
- `llamaindex/loaders/` - Document format-specific loaders (PDF, DOCX, Markdown)
- `types/` - TypeScript type definitions and interfaces
