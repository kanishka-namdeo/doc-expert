# API Routes

## Purpose

Next.js App Router API routes providing backend endpoints for authentication, chat, documents, and MCP server integration.

## Ownership

- API route handlers for all backend operations
- Request validation and error handling
- Response formatting and status codes

## Local Contracts

- Routes follow Next.js App Router conventions (`route.ts` files)
- Server-side only code (no client components)
- Use proper HTTP methods and status codes
- Validate input before processing

## Work Guidance

### Route structure

- `auth/` - Authentication endpoints (login, signup, session management)
- `chat/` - Chat interaction endpoints (supports `collectionId` for scoped retrieval)
- `documents/` - Document CRUD operations
- `admin/models/` - On-prem Ollama model management (pull, delete, set default)
- `admin/models/default/` - Default model configuration (stored in `systemConfig` table)
- `collections/` - Document collection CRUD for scoped Q&A workspaces
- `templates/` - Prompt template CRUD (user templates + system defaults)
- `mcp/` - MCP (Model Context Protocol) server integration

### Creating new routes

1. Create directory under `app/api/` with route name
2. Add `route.ts` file with handler functions
3. Export named functions for each HTTP method (GET, POST, etc.)
4. Validate request body and params
5. Return proper Response objects with appropriate status codes

### Error handling

- Return descriptive error messages
- Use appropriate HTTP status codes (400, 401, 404, 500)
- Log errors for debugging without exposing internals to clients

## Subagent Delegation

Use `api-specialist` subagent for all work in this directory. It owns API route patterns, request validation, error handling, and response formatting conventions.

## Verification

- Test endpoints with curl or API client
- Verify authentication guards work correctly
- Check error responses for edge cases

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
