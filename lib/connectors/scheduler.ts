import { eq, lt, or, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { connectorAccount, systemConfig } from '@/lib/db/schema';
import { getConnector } from './registry';
import { runSync } from './sync-engine';
import { getLogger } from '@/lib/logger';

const logger = getLogger('connectors/scheduler');

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

async function getSyncInterval(): Promise<number> {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'connector.syncIntervalMs'),
    });
    if (config) {
      const val = parseInt(config.value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_INTERVAL_MS;
}

async function runScheduledSyncs(): Promise<void> {
  const now = new Date();
  const intervalMs = await getSyncInterval();
  const cutoff = new Date(now.getTime() - intervalMs);

  try {
    const accounts = await db.query.connectorAccount.findMany({
      where: or(
        eq(connectorAccount.syncStatus, 'idle'),
        isNull(connectorAccount.lastSyncedAt),
        lt(connectorAccount.lastSyncedAt, cutoff),
      ),
    });

    logger.info({ count: accounts.length, intervalMs }, 'Scheduled sync check');

    for (const account of accounts) {
      const connector = getConnector(account.connectorId);
      if (!connector) {
        logger.warn({ connectorId: account.connectorId }, 'Unknown connector, skipping');
        continue;
      }

      try {
        const accountOrgId = account.orgId ?? '';
        if (!accountOrgId) {
          logger.warn({ connectorId: account.connectorId, userId: account.userId }, 'Account has no orgId, skipping');
          continue;
        }
        await runSync(connector, { ...account, orgId: accountOrgId });
      } catch (err) {
        logger.error(
          { err, connectorId: account.connectorId, userId: account.userId },
          'Scheduled sync failed',
        );
      }
    }
  } catch (err) {
    logger.error({ err }, 'Scheduled sync query failed');
  }
}

export function startScheduler(): void {
  if (schedulerInterval) {
    logger.warn('Scheduler already running');
    return;
  }

  // Run immediately on startup
  runScheduledSyncs().catch((err) =>
    logger.error({ err }, 'Initial scheduled sync failed'),
  );

  // Then run at the configured interval
  getSyncInterval().then((intervalMs) => {
    schedulerInterval = setInterval(() => {
      runScheduledSyncs().catch((err) =>
        logger.error({ err }, 'Scheduled sync failed'),
      );
    }, intervalMs);

    logger.info({ intervalMs }, 'Scheduler started');
  });
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler stopped');
  }
}
