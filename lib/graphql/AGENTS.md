# GraphQL Layer

## Purpose

GraphQL API schema definitions and resolver context for the application's GraphQL endpoint.

## Ownership

- GraphQL schema definitions using Pothos builder
- Resolver context construction and type registration
- Query and mutation type definitions

## Local Contracts

- Schema built with `@pothos/core` following builder pattern
- Context provided via `lib/graphql/context.ts` for resolver access to auth, db, and services
- Types defined inline with schema or in dedicated type files

## Work Guidance

### Key modules

- `schema.ts` - GraphQL schema builder and type definitions
- `context.ts` - Resolver context factory with auth, database, and service access

### Adding new types or fields

1. Define type or field in `schema.ts` using the Pothos builder
2. Add resolver logic referencing context for data access
3. Ensure types are registered before use in queries/mutations

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test GraphQL queries via `/api/graphql` endpoint
- Verify authentication guards in resolvers

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
