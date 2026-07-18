# Subagent Configuration

## Purpose

Defines specialized subagents for domain-specific work delegation across the project.

## Ownership

- Subagent prompt files (api, auth, database, frontend, rag, testing specialists)
- Subagent capability boundaries and tool access

## Local Contracts

- Each `.md` file defines one specialist subagent
- Subagents are referenced by name in DOX delegation guidance
- Subagent prompts encode domain knowledge and conventions

## Work Guidance

### Available subagents

- `api-specialist.md` - Next.js API routes, request validation, error handling
- `auth-specialist.md` - Better Auth, RBAC, session management, security
- `database-specialist.md` - Drizzle ORM, SQLite, schema design, migrations
- `frontend-specialist.md` - React components, hooks, client-side logic, shadcn/ui
- `rag-specialist.md` - LlamaIndex pipeline, Qdrant, embeddings, document loaders
- `testing-specialist.md` - Playwright E2E tests, test automation

### Adding new subagents

1. Create `<name>-specialist.md` following existing file structure
2. Define scope, capabilities, and tool access
3. Reference the new subagent in relevant DOX files

## Verification

- Subagent names must match references in parent DOX files
- Each subagent file must be self-contained with clear scope boundaries
