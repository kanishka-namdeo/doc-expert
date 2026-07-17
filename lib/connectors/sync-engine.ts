import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { document, connectorAccount } from '@/lib/db/schema';
import { ingestBuffer } from '@/lib/llamaindex/ingest';
import { getLogger } from '@/lib/logger';
import type { Connector, OAuthTokens, WebhookDelta, IngestProgress } from './types';
import type { SyncStats } from './types';

const logger = getLogger('connectors/sync-engine');

export interface SyncProgress {
  step: string;
  progress: number;
  message: string;
  stats?: SyncStats;
}

function emitProgress(
  onProgress?: (progress: SyncProgress) => void,
  step?: string,
  progress?: number,
  message?: string,
  stats?: SyncStats,
): void {
  if (onProgress) {
    onProgress({
      step: step ?? 'sync',
      progress: progress ?? 0,
      message: message ?? '',
      stats,
    });
  }
}

/**
 * Ensure tokens are fresh — refresh if expired.
 */
async function ensureFreshTokens(
  connector: Connector,
  tokens: OAuthTokens,
  accountId: string,
): Promise<OAuthTokens> {
  if (connector.isTokenExpired(tokens)) {
    logger.info({ connectorId: connector.id }, 'Token expired, refreshing');
    const refreshed = await connector.refreshToken(tokens);
    // Persist refreshed tokens
    await db
      .update(connectorAccount)
      .set({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? null,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt
          ? new Date(refreshed.accessTokenExpiresAt)
          : null,
        scope: refreshed.scope ?? null,
        updatedAt: new Date(),
      })
      .where(eq(connectorAccount.id, accountId));
    return refreshed;
  }
  return tokens;
}

/**
 * Full sync: list all remote documents, ingest new/changed ones.
 */
export async function runSync(
  connector: Connector,
  account: {
    id: string;
    userId: string;
    orgId: string;
    connectorId: string;
    accessToken: string;
    refreshToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    scope?: string | null;
  },
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncStats> {
  const stats: SyncStats = {
    found: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    skipped: 0,
  };

  emitProgress(onProgress, 'start', 0, 'Starting sync...', stats);

  // Mark as syncing
  await db
    .update(connectorAccount)
    .set({ syncStatus: 'syncing', updatedAt: new Date() })
    .where(eq(connectorAccount.id, account.id));

  let tokens: OAuthTokens = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken ?? undefined,
    accessTokenExpiresAt: account.accessTokenExpiresAt?.getTime(),
    scope: account.scope ?? undefined,
  };

  try {
    tokens = await ensureFreshTokens(connector, tokens, account.id);
  } catch (err) {
    logger.error({ err, connectorId: connector.id }, 'Token refresh failed');
    emitProgress(onProgress, 'error', 0, 'Token refresh failed', stats);
    await markSyncError(account.id, String(err));
    stats.errors++;
    return stats;
  }

  emitProgress(onProgress, 'list', 5, 'Listing remote documents...', stats);

  // Paginate through all documents
  let pageToken: string | undefined;
  const allRemoteDocs: Array<{ id: string; name: string; mimeType: string; size: number; createdAt: string; modifiedAt: string; webUrl?: string }> = [];

  try {
    do {
      const result = await connector.listDocuments(tokens, {
        pageToken,
        pageSize: 100,
      });
      allRemoteDocs.push(...result.documents);
      pageToken = result.nextPageToken;
      logger.info(
        { connectorId: connector.id, count: result.documents.length, pageToken },
        'Listed page',
      );
    } while (pageToken);
  } catch (err) {
    logger.error({ err, connectorId: connector.id }, 'List documents failed');
    emitProgress(onProgress, 'error', 0, 'Failed to list documents', stats);
    await markSyncError(account.id, String(err));
    stats.errors++;
    return stats;
  }

  stats.found = allRemoteDocs.length;
  emitProgress(onProgress, 'list', 10, `Found ${stats.found} remote documents`, stats);

  // Process each remote document
  const total = allRemoteDocs.length;
  for (let i = 0; i < total; i++) {
    const remote = allRemoteDocs[i];
    const progressPct = 10 + Math.round((i / total) * 80);
    emitProgress(
      onProgress,
      'sync',
      progressPct,
      `Processing ${i + 1}/${total}: ${remote.name}`,
      stats,
    );

    try {
      await processRemoteDocument(connector, tokens, account, remote, stats);
    } catch (err) {
      logger.error(
        { err, connectorId: connector.id, externalId: remote.id },
        'Failed to process remote document',
      );
      stats.errors++;
    }
  }

  emitProgress(onProgress, 'complete', 100, 'Sync complete', stats);

  // Update lastSyncedAt and status
  await db
    .update(connectorAccount)
    .set({
      lastSyncedAt: new Date(),
      syncStatus: 'idle',
      updatedAt: new Date(),
    })
    .where(eq(connectorAccount.id, account.id));

  logger.info(
    { connectorId: connector.id, userId: account.userId, stats },
    'Sync completed',
  );

  return stats;
}

async function processRemoteDocument(
  connector: Connector,
  tokens: OAuthTokens,
  account: { id: string; userId: string; orgId: string; connectorId: string },
  remote: { id: string; name: string; mimeType: string; size: number; createdAt: string; modifiedAt: string; webUrl?: string },
  stats: SyncStats,
): Promise<void> {
  const source = connector.id;
  const externalId = remote.id;

  // Check if document already exists
  const existing = await db.query.document.findFirst({
    where: and(
      eq(document.userId, account.userId),
      eq(document.source, source),
      eq(document.externalId, externalId),
    ),
  });

  const remoteModifiedAt = new Date(remote.modifiedAt).getTime();

  if (existing) {
    // Check if remote has been modified since last sync
    if (
      existing.lastRemoteModified &&
      remoteModifiedAt <= existing.lastRemoteModified.getTime()
    ) {
      stats.skipped++;
      return; // No change
    }

    // Fetch updated content
    const { buffer, mimeType, fileName } = await connector.fetchDocument(
      tokens,
      externalId,
      { mimeType: remote.mimeType, fileName: remote.name },
    );

    const result = await ingestBuffer(
      buffer,
      mimeType,
      fileName,
      account.userId,
      account.orgId,
      { source, externalId, webUrl: remote.webUrl },
    );

    await db
      .update(document)
      .set({
        mediaType: mimeType,
        fileSize: buffer.length,
        lastRemoteModified: new Date(remote.modifiedAt),
        updatedAt: new Date(),
      })
      .where(eq(document.id, existing.id));

    stats.updated++;
    logger.info(
      { documentId: existing.id, externalId, fileName },
      'Document updated',
    );
  } else {
    // New document — ingest
    const { buffer, mimeType, fileName } = await connector.fetchDocument(
      tokens,
      externalId,
      { mimeType: remote.mimeType, fileName: remote.name },
    );

    const result = await ingestBuffer(
      buffer,
      mimeType,
      fileName,
      account.userId,
      account.orgId,
      { source, externalId, webUrl: remote.webUrl },
    );

    await db.insert(document).values({
      id: result.documentId,
      userId: account.userId,
      orgId: account.orgId,
      fileName,
      mediaType: mimeType,
      fileSize: buffer.length,
      status: 'approved',
      source,
      externalId,
      lastRemoteModified: new Date(remote.modifiedAt),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    stats.created++;
    logger.info(
      { documentId: result.documentId, externalId, fileName },
      'Document ingested from connector',
    );
  }
}

/**
 * Delta sync: process webhook deltas for specific documents.
 */
export async function runDeltaSync(
  connector: Connector,
  account: {
    id: string;
    userId: string;
    orgId: string;
    connectorId: string;
    accessToken: string;
    refreshToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    scope?: string | null;
  },
  deltas: WebhookDelta[],
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncStats> {
  const stats: SyncStats = {
    found: deltas.length,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    skipped: 0,
  };

  let tokens: OAuthTokens = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken ?? undefined,
    accessTokenExpiresAt: account.accessTokenExpiresAt?.getTime(),
    scope: account.scope ?? undefined,
  };

  try {
    tokens = await ensureFreshTokens(connector, tokens, account.id);
  } catch (err) {
    logger.error({ err }, 'Delta sync token refresh failed');
    stats.errors++;
    return stats;
  }

  for (const delta of deltas) {
    try {
      if (delta.kind === 'deleted') {
        // Mark document as deleted — remove from DB and Qdrant
        await db
          .update(document)
          .set({ status: 'rejected', updatedAt: new Date() })
          .where(
            and(
              eq(document.userId, account.userId),
              eq(document.source, connector.id),
              eq(document.externalId, delta.externalId),
            ),
          );
        stats.deleted++;
      } else {
        // created or updated — fetch and re-ingest
        const { buffer, mimeType, fileName } = await connector.fetchDocument(
          tokens,
          delta.externalId,
        );

        // Check if exists
        const existing = await db.query.document.findFirst({
          where: and(
            eq(document.userId, account.userId),
            eq(document.source, connector.id),
            eq(document.externalId, delta.externalId),
          ),
        });

        if (existing) {
          await ingestBuffer(
            buffer,
            mimeType,
            fileName,
            account.userId,
            account.orgId,
            { source: connector.id, externalId: delta.externalId },
            undefined,
            existing.id,
          );
          stats.updated++;
        } else {
          const result = await ingestBuffer(
            buffer,
            mimeType,
            fileName,
            account.userId,
            account.orgId,
            { source: connector.id, externalId: delta.externalId },
          );
          await db.insert(document).values({
            id: result.documentId,
            userId: account.userId,
            orgId: account.orgId,
            fileName,
            mediaType: mimeType,
            fileSize: buffer.length,
            status: 'approved',
            source: connector.id,
            externalId: delta.externalId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          stats.created++;
        }
      }
    } catch (err) {
      logger.error({ err, externalId: delta.externalId }, 'Delta sync failed');
      stats.errors++;
    }
  }

  emitProgress(onProgress, 'delta', 100, `Delta sync complete: ${stats.created} created, ${stats.updated} updated, ${stats.deleted} deleted`, stats);
  return stats;
}

async function markSyncError(accountId: string, error: string): Promise<void> {
  await db
    .update(connectorAccount)
    .set({ syncStatus: 'error', updatedAt: new Date() })
    .where(eq(connectorAccount.id, accountId));
}
