import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connectorAccount } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getConnector } from '@/lib/connectors/registry';
import { runDeltaSync } from '@/lib/connectors/sync-engine';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/connectors/webhook');

export async function POST(request: NextRequest) {
  // Determine which connector this webhook is for based on path
  const pathname = request.nextUrl.pathname;

  let connectorId: string;
  if (pathname.includes('google-drive')) {
    connectorId = 'google-drive';
  } else if (pathname.includes('microsoft-365')) {
    connectorId = 'microsoft-365';
  } else {
    return NextResponse.json({ error: 'Unknown webhook path' }, { status: 400 });
  }

  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json({ error: 'Unknown connector' }, { status: 404 });
  }

  // For Microsoft 365, handle validation token response
  if (connectorId === 'microsoft-365') {
    const validationToken = request.nextUrl.searchParams.get('validationToken');
    if (validationToken) {
      // Return the validation token as plain text
      return new Response(validationToken, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  // We need to find the account — for Google, the resource-id header may help.
  // For simplicity, process webhooks for all connected accounts of this connector type.
  const accounts = await db.query.connectorAccount.findMany({
    where: eq(connectorAccount.connectorId, connectorId),
  });

  if (accounts.length === 0) {
    return NextResponse.json({ error: 'No accounts connected' }, { status: 404 });
  }

  // Process webhooks for each account (in practice, webhooks target a specific subscription)
  for (const account of accounts) {
    try {
      const tokens = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken ?? undefined,
        accessTokenExpiresAt: account.accessTokenExpiresAt?.getTime(),
        scope: account.scope ?? undefined,
      };

      const deltas = await connector.handleWebhook(request, tokens);

      if (deltas.length > 0) {
        await runDeltaSync(
          connector,
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
          deltas,
        );
      }
    } catch (err) {
      // Microsoft sends a validationTokenError on subscription creation —
      // the token itself should be returned as plain text.
      if (
        err instanceof Error &&
        err.name === 'ValidationTokenError' &&
        'token' in err
      ) {
        return new Response((err as { token: string }).token, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      logger.error(
        { err, connectorId, userId: account.userId },
        'Webhook processing failed',
      );
    }
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}
