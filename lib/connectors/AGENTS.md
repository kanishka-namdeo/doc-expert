# Connectors Module

## Purpose

Multi-source document connector framework for ingesting documents from external data sources (Google Drive, Microsoft 365) via OAuth. Manages authentication, document listing, fetching, webhook-based delta sync, and scheduled synchronization.

## Ownership

- Connector interface and registry
- OAuth flows for external providers
- Document listing and fetching from remote sources
- Sync engine and scheduler
- Webhook handling for real-time updates

## Local Contracts

- All connectors implement the `Connector` interface from `types.ts`
- Connectors are registered via `registerConnector()` and retrieved via `getConnector(id)`
- OAuth tokens are stored in the `connectorAccount` database table (not the Better Auth `account` table)
- Sync state is tracked in `connectorAccount` (`lastSyncedAt`, `syncStatus`, `webhookSubscriptionId`)
- Documents synced from connectors are stored in the `document` table with `source` and `externalId` fields
- The scheduler runs via Next.js instrumentation hook (`app/instrumentation.ts`)

## Work Guidance

### Key modules

- `types.ts` - Core TypeScript interfaces (`Connector`, `ConnectorDocument`, `OAuthTokens`, `SyncStats`, `WebhookDelta`)
- `registry.ts` - Connector registry (register, get, list). Pre-registers `google-drive` and `microsoft-365`.
- `google-drive/` - Google Drive connector (OAuth, documents, webhook)
- `microsoft-365/` - Microsoft 365 connector (OAuth, documents, webhook)
- `sync-engine.ts` - `runSync()` and `runDeltaSync()` orchestrators with partial failure handling
- `scheduler.ts` - Background sync scheduler via Next.js instrumentation hook (`app/instrumentation.ts`)

### Sync interval

Configurable via `systemConfig` table key `connector.syncIntervalMs`. Defaults to 1 hour.

### Adding new connectors

1. Create a directory under `lib/connectors/<provider>/`
2. Implement `oauth.ts`, `documents.ts`, `webhook.ts` following existing patterns
3. Assemble the connector in `index.ts` implementing the `Connector` interface
4. Register the connector in `registry.ts`

### OAuth configuration

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Microsoft: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- Scopes: Google uses `drive.readonly`; Microsoft uses `Files.Read.All`, `Sites.Read.All`

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test OAuth flow with real provider accounts
- Verify sync engine deduplication logic
- Confirm scheduler starts on server boot

## Child DOX Index

- `google-drive/` - Google Drive connector (OAuth, documents, webhook)
- `microsoft-365/` - Microsoft 365 connector (OAuth, documents, webhook)
