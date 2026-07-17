import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { connectorAccount } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getConnector } from '@/lib/connectors/registry';
import { runSync } from '@/lib/connectors/sync-engine';
import type { SyncProgress } from '@/lib/connectors/sync-engine';
import { getAuthSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const { id: connectorId } = await params;
  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json(
      { error: `Unknown connector: ${connectorId}` },
      { status: 404 },
    );
  }

  const account = await db.query.connectorAccount.findFirst({
    where: and(
      eq(connectorAccount.userId, userId),
      eq(connectorAccount.connectorId, connectorId),
      eq(connectorAccount.orgId, orgId),
    ),
  });

  if (!account) {
    return NextResponse.json(
      { error: 'Connector not connected' },
      { status: 404 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const onProgress = (progress: SyncProgress) => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(progress)}\n\n`),
          );
        };

        const stats = await runSync(
          connector!,
          {
            id: account.id,
            userId: account.userId,
            orgId: account.orgId ?? '',
            connectorId: account.connectorId,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            accessTokenExpiresAt: account.accessTokenExpiresAt,
            scope: account.scope,
          },
          onProgress,
        );

        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: 'complete', stats })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
