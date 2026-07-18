# End-to-End Tests

## Purpose

Playwright E2E test suite covering critical user flows and integrations.

## Ownership

- Playwright test specifications
- Test fixtures and helpers
- CI test configuration

## Local Contracts

- Tests use Playwright test runner
- Test files follow `*.spec.ts` naming convention
- Tests run against the development server

## Work Guidance

### Test files

- `connectors.spec.ts` - Connector integration tests
- `enterprise.spec.ts` - Enterprise feature tests (groups, SSO, permissions)
- `rag-flow.spec.ts` - RAG ingestion and retrieval flow tests

### Running tests

```bash
pnpm test:e2e
```

## Verification

- All tests must pass before merging
- Add tests for new features and bug fixes
