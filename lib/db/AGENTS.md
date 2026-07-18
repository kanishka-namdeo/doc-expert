# Database Layer

## Purpose

SQLite database access layer using Drizzle ORM. Manages schema definitions, migrations, and database connections.

## Ownership

- Database schema definitions
- Drizzle ORM configuration
- Database connection management
- Type-safe query builders

## Local Contracts

- Schema defined in `schema.ts` using Drizzle's table definitions
- Database client initialized in `index.ts`
- Use Drizzle's query builder for all database operations
- SQLite adapter configured for local development

## Work Guidance

### Key modules

- `schema.ts` - Database table definitions and relationships (user, session, conversation, message, document, auditLog, systemConfig, collection, collectionDocument, promptTemplate, documentPermission, group, groupMember)
- `index.ts` - Database connection and Drizzle instance export

### Adding new tables

1. Define table in `schema.ts` using Drizzle's API
2. Export the table for use in queries
3. Update any related types or interfaces
4. Run migrations if migration system is configured

### Query patterns

- Use Drizzle's type-safe query builder
- Prefer explicit column selection over `*`
- Handle errors gracefully at the service layer

## Subagent Delegation

Use `database-specialist` subagent for all work in this directory. It owns Drizzle ORM schema design, query patterns, migrations, and SQLite-specific considerations.

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test database operations with sample data
- Verify schema changes don't break existing queries

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
