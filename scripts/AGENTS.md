# Scripts

## Purpose

Database initialization, migration, seeding, and utility scripts for development and operations.

## Ownership

- Database initialization (`init-db.mjs`)
- Test account seeding (`seed-accounts.mjs`)
- Data migration scripts
- Evaluation and smoke test utilities

## Local Contracts

- Scripts use `.mjs` extension for ES module support
- Run with `node scripts/<name>.mjs`
- Scripts access the database directly via Drizzle

## Work Guidance

### Available scripts

- `init-db.mjs` - Initialize database schema and default data
- `seed-accounts.mjs` - Create/reset test accounts (admin, editor, viewer, user)
- `migrate-access-control.mjs` - Migrate access control data
- `migrate-conversation-share.mjs` - Migrate conversation sharing data
- `migrate-multi-tenancy.mjs` - Migrate multi-tenancy data
- `eval-retrieval.mjs` - Evaluate RAG retrieval quality
- `smoke-test-retrieval.mjs` - Smoke test for retrieval pipeline
- `create-test-user.js` - Create individual test user

## Verification

- Test scripts against development database
- Verify migrations are idempotent where possible
