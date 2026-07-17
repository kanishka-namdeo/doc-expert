import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { connectorAccount, document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getConnector } from '@/lib/connectors/registry';
import { getAuthSession } from '@/lib/auth/session';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const { id: connectorId } = await params;
  const connector = getConnector(connectorId);

  const account = await db.query.connectorAccount.findFirst({
    where: and(
      eq(connectorAccount.userId, userId),
      eq(connectorAccount.connectorId, connectorId),
      eq(connectorAccount.orgId, orgId),
    ),
  });

  if (!account) {
    return NextResponse.json(
      { error: 'Connector account not found' },
      { status: 404 },
    );
  }

  // Revoke webhook subscription if present
  if (account.webhookSubscriptionId && connector) {
    try {
      const tokens = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken ?? undefined,
        accessTokenExpiresAt: account.accessTokenExpiresAt?.getTime(),
        scope: account.scope ?? undefined,
      };
      const webhookConfig = connector.getWebhookConfig();
      if (webhookConfig.path.includes('microsoft-365')) {
        const { deleteSubscription } = await import(
          '@/lib/connectors/microsoft-365/webhook'
        );
        await deleteSubscription(tokens, account.webhookSubscriptionId);
      } else if (webhookConfig.path.includes('google-drive')) {
        const { stopWebhook } = await import(
          '@/lib/connectors/google-drive/webhook'
        );
        await stopWebhook(tokens, account.webhookSubscriptionId);
      }
    } catch {
      // Best-effort revoke
    }
  }

  // Delete the account
  await db
    .delete(connectorAccount)
    .where(eq(connectorAccount.id, account.id));

  // Optionally mark synced documents as no longer tracked
  // (keep them in DB but clear externalId so they won't be re-synced)
  await db
    .update(document)
    .set({ source: 'upload', externalId: null })
    .where(
      and(
        eq(document.userId, userId),
        eq(document.orgId, orgId),
        eq(document.source, connectorId),
      ),
    );

  return NextResponse.json({ success: true });
}
