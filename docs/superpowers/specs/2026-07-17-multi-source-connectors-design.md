# Multi-Source Connector Framework Design

**Date:** 2026-07-17  
**Status:** Approved  
**Scope:** Plugin-based connector framework for Google Workspace and Microsoft 365

---

## Overview

Doc Expert currently supports only local file uploads (PDF, DOCX, Markdown). Enterprise RAG platforms like Glean and Cohere dominate by pulling knowledge from wherever it already lives. This design adds a plugin-based connector framework that integrates with Google Workspace and Microsoft 365, with per-user OAuth authentication and hybrid sync (scheduled full syncs + webhook deltas).

---

## Architecture

### Approach: Plugin-based Connector Registry

Each external data source is a self-contained module implementing a `Connector` interface. A registry tracks available connectors. The sync engine is generic — it works off the interface, not concrete implementations.

**Why this approach:**
- Clean separation: each connector independently testable
- Trivial to add new sources later (Slack, Confluence, S3, etc.)
- Maps to how enterprise platforms structure integrations
- Forces abstraction before bias from specific implementations

---

## Core Components

### 1. Connector Interface & Registry

**Location:** `lib/connectors/types.ts`

```typescript
export interface ConnectorDocument {
  externalId: string;       // ID in the external system
  title: string;            // Human-readable name
  mimeType: string;         // Normalized MIME type
  content: Buffer;          // Raw file content
  lastModified: Date;       // When it was last changed remotely
  webUrl: string;           // Link back to the original document
  metadata?: Record<string, unknown>;
}

export interface Connector {
  id: string;               // 'google-drive' | 'microsoft-365'
  name: string;             // 'Google Drive' | 'Microsoft 365'
  icon: string;             // For UI display

  // OAuth
  getAuthUrl(state: string): string;
  handleCallback(code: string, state: string): Promise<OAuthTokens>;
  refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
  isTokenExpired(tokens: OAuthTokens): boolean;

  // Document operations
  listDocuments(tokens: OAuthTokens, options?: ListOptions): Promise<ConnectorDocument[]>;
  fetchDocument(tokens: OAuthTokens, externalId: string): Promise<ConnectorDocument>;

  // Webhooks
  getWebhookConfig(): { path: string; events: string[] } | null;
  handleWebhook?(request: Request, tokens: OAuthTokens): Promise<WebhookDelta[]>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  scope: string;
}

export interface ListOptions {
  cursor?: string;
  pageSize?: number;
  mimeTypeFilter?: string[];
  modifiedAfter?: Date;
}

export interface WebhookDelta {
  action: 'created' | 'updated' | 'deleted';
  externalId: string;
}
```

**Registry:** `lib/connectors/registry.ts`

Simple map-based registry. Connectors register themselves on module load.

---

### 2. Sync Engine

**Location:** `lib/connectors/sync-engine.ts`

The sync engine orchestrates document synchronization. It doesn't know about Google or Microsoft — it works off the `Connector` interface.

**Sync modes:**
- **Full sync:** List all remote docs, compare with local `document` table by `(source, externalId)`, fetch and ingest new/updated docs, mark deleted docs
- **Incremental sync:** Use `modifiedAfter` filter to fetch only docs changed since last sync
- **Delta sync:** Process webhook notifications for near-real-time updates

**Sync job tracking:**

```typescript
export interface SyncJob {
  id: string;
  userId: string;
  connectorId: string;
  mode: 'full' | 'incremental' | 'delta';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  stats: SyncStats;
}

export interface SyncStats {
  documentsFound: number;
  documentsCreated: number;
  documentsUpdated: number;
  documentsDeleted: number;
  errors: number;
}
```

**Ingestion integration:**

Refactor `lib/llamaindex/ingest.ts` to expose a buffer-based entry point:

```typescript
export async function ingestBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  userId: string,
  metadata?: Record<string, unknown>,
  onProgress?: (progress: IngestProgress) => void,
  existingDocumentId?: string
): Promise<{ documentId: string; chunkCount: number }>

// ingestDocument becomes a thin wrapper
export async function ingestDocument(file: File, ...) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return ingestBuffer(buffer, file.type, file.name, ...);
}
```

---

### 3. Database Schema

**New table:** `connectorAccount`

```typescript
export const connectorAccount = sqliteTable('connector_account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  connectorId: text('connectorId').notNull(),     // 'google-drive' | 'microsoft-365'
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken').notNull(),
  accessTokenExpiresAt: integer('accessTokenExpiresAt').notNull(),
  scope: text('scope'),
  lastSyncedAt: integer('lastSyncedAt', { mode: 'timestamp_ms' }),
  syncStatus: text('syncStatus').default('idle'),  // 'idle' | 'syncing' | 'error'
  webhookSubscriptionId: text('webhookSubscriptionId'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
```

**Extended `document` table:**

Add columns to track source:

```typescript
source: text('source').default('upload'),          // 'upload' | 'google-drive' | 'microsoft-365'
externalId: text('externalId'),                     // Remote doc ID from the connector
lastRemoteModified: integer('lastRemoteModified', { mode: 'timestamp_ms' }),
```

Unique constraint on `(userId, source, externalId)` prevents duplicate ingestion.

---

### 4. API Routes

**Location:** `app/api/connectors/`

```
app/api/connectors/
├── [id]/
│   ├── route.ts          # GET status, DELETE disconnect
│   ├── sync/route.ts     # POST trigger manual sync
│   └── callback/route.ts # GET OAuth redirect handler
├── auth/route.ts         # GET initiate OAuth flow
├── webhook/route.ts      # POST receives webhook notifications
└── route.ts              # GET list connected accounts
```

**OAuth flow:**
1. `GET /api/connectors/auth?connectorId=google-drive` → returns `{ url }`
2. Frontend opens URL in popup window
3. Popup completes OAuth, redirects to callback
4. Callback exchanges code for tokens, stores in `connectorAccount`, posts message to opener
5. Settings page refreshes connector list

**Manual sync:**

`POST /api/connectors/[id]/sync` streams progress via SSE (same pattern as upload route).

**Webhook endpoint:**

`POST /api/connectors/webhook` validates signature, looks up account, calls `connector.handleWebhook()`, triggers targeted re-ingest for deltas.

---

### 5. Scheduled Sync

**Location:** `lib/connectors/scheduler.ts`

Runs via Next.js instrumentation hook (`app/instrumentation.ts`).

**Default interval:** 1 hour (configurable via `systemConfig` table, key: `connector.syncIntervalMs`)

**Logic:**
- Query all `connectorAccount` rows with `syncStatus = 'idle'`
- Skip if `lastSyncedAt` is within the interval
- Run incremental sync for each account

**Webhook + scheduled interplay:**
- Webhooks handle near-real-time deltas
- Scheduled sync is the safety net (catches missed webhooks, permission changes, new files)
- Sync is idempotent — overlapping runs are safe

---

### 6. Frontend UI

**Connectors settings page:** `app/settings/connectors/page.tsx`

Lists all available connectors with connection status, last sync time, document count, and action buttons (Connect/Sync now/Disconnect).

**OAuth connection flow:**

Popup-based OAuth to keep user in app. Popup posts message back to settings page on completion.

**Sync progress indicator:**

Progress bar on connector card during sync (SSE stream from sync endpoint).

**Document source badge:**

Small badge on document list showing source (Upload/Google Drive/Microsoft 365).

---

### 7. Error Handling

**Token expiry:** Check `isTokenExpired()` before API calls. Refresh if expired. If refresh fails, mark sync as `'error'` and show "Reconnect" in UI.

**Partial failures:** Continue processing on individual doc errors. Track `SyncStats.errors`. Job completes if at least one doc succeeded.

**Rate limiting:** Exponential backoff with jitter. Respect `Retry-After` headers.

**Duplicate detection:** Unique constraint on `(userId, source, externalId)`. Only re-ingest if `lastRemoteModified` is newer.

**Webhook validation:** Validate signatures (Google: HMAC-SHA256, Microsoft: validation token + encrypted JWT). Reject invalid with 401.

**Orphaned documents:** When connector disconnected, docs remain. Cleanup job removes docs from disconnected accounts older than 30 days (configurable).

---

## Implementation Order

1. **Connector interface & registry** — define types, build registry
2. **Database schema** — add `connectorAccount` table, extend `document` table
3. **Ingestion refactor** — extract `ingestBuffer()` from existing `ingestDocument()`
4. **Google Drive connector** — implement OAuth, list/fetch, webhook handling
5. **Microsoft 365 connector** — implement OAuth, list/fetch, webhook handling
6. **Sync engine** — build generic sync orchestrator
7. **Scheduler** — add instrumentation hook and interval-based sync
8. **API routes** — implement all connector endpoints
9. **Frontend UI** — settings page, OAuth flow, sync progress, source badges
10. **Testing** — unit tests for connectors, integration tests for sync, E2E tests for UI

---

## Testing Strategy

- **Unit tests:** Mock OAuth flows, test token refresh logic, validate webhook signature handling
- **Integration tests:** Test sync engine with mock connectors, verify deduplication logic
- **E2E tests:** Full OAuth flow, manual sync, webhook delta processing
- **Manual testing:** Connect real Google Drive and Microsoft 365 accounts, verify document ingestion

---

## Future Extensions

- **Additional connectors:** Slack, Confluence, S3, Google Drive Shared Drives, SharePoint Sites
- **Background job queue:** Move sync to a proper queue (BullMQ, Temporal) for multi-instance deployments
- **Admin dashboard:** Connector usage analytics, error rates, sync health
- **Permission scoping:** Let users choose which folders/drives to sync
- **Conflict resolution:** Handle cases where local edits conflict with remote changes

---

## Sovereignty Considerations

- **Per-user OAuth:** Each user controls what the app can access. No shared service accounts.
- **Token storage:** OAuth tokens encrypted at rest in SQLite (using Better Auth's encryption)
- **Data residency:** All ingested content stays in local Qdrant instance. No external API calls after initial fetch.
- **Audit logging:** All connector actions logged to `auditLog` table for compliance
- **Revocation:** Users can disconnect at any time. Cleanup job removes orphaned docs after 30 days.

---

## Success Criteria

- Users can connect Google Drive and Microsoft 365 accounts via OAuth
- Documents from connected sources are searchable in chat
- Sync runs hourly and processes webhook deltas in near-real-time
- UI shows connection status, sync progress, and document source badges
- Error handling covers token expiry, rate limits, partial failures
- No breaking changes to existing upload workflow
