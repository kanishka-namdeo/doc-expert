import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { connectorAccount, document } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { listConnectors } from '@/lib/connectors/registry';
import { getAuthSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const accounts = await db.query.connectorAccount.findMany({
    where: and(eq(connectorAccount.userId, userId), eq(connectorAccount.orgId, orgId)),
  });

  const available = listConnectors();

  const result = available.map((connector) => {
    const account = accounts.find((a) => a.connectorId === connector.id);
    return {
      id: connector.id,
      name: connector.name,
      icon: connector.icon,
      connected: !!account,
      lastSyncedAt: account?.lastSyncedAt ?? null,
      syncStatus: account?.syncStatus ?? 'idle',
      documentCount: 0, // filled below
    };
  });

  // Count documents per connector
  if (result.length > 0) {
    const counts = await db
      .select({
        source: document.source,
        count: sql<number>`count(*)`,
      })
      .from(document)
      .where(and(eq(document.userId, userId), eq(document.orgId, orgId), sql`source != 'upload'`))
      .groupBy(document.source);

    for (const c of counts) {
      const entry = result.find((r) => r.id === c.source);
      if (entry) entry.documentCount = Number(c.count);
    }
  }

  return NextResponse.json(result);
}
