import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/connectors/registry';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { connectorAccount } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createSubscription } from '@/lib/connectors/microsoft-365/webhook';

const connector = getConnector('microsoft-365');

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return new Response(
      `<html><body><script>window.close();</script>OAuth error: ${error}</body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  if (!code || !state || !connector) {
    return new Response(
      '<html><body><script>window.close();</script>Invalid callback</body></html>',
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  try {
    const tokens = await connector.handleCallback(code, state);

    const session = await auth.api.getSession({ headers: request.headers });
    const isDev = process.env.NODE_ENV === 'development';
    const userId = session?.user?.id ?? (isDev ? 'dev-user' : null);

    if (!userId) {
      return new Response(
        '<html><body><script>window.close();</script>Not authenticated</body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    const existing = await db.query.connectorAccount.findFirst({
      where: (ca, { and, eq }) =>
        and(eq(ca.userId, userId), eq(ca.connectorId, 'microsoft-365')),
    }) as { id: string } | undefined;

    if (existing) {
      await db
        .update(connectorAccount)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          accessTokenExpiresAt: tokens.accessTokenExpiresAt
            ? new Date(tokens.accessTokenExpiresAt)
            : null,
          scope: tokens.scope ?? null,
          updatedAt: new Date(),
        })
        .where(eq(connectorAccount.id, existing.id));
    } else {
      await db.insert(connectorAccount).values({
        id: randomUUID(),
        userId,
        connectorId: 'microsoft-365',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt
          ? new Date(tokens.accessTokenExpiresAt)
          : null,
        scope: tokens.scope ?? null,
        syncStatus: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Set up webhook subscription
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/connectors/webhook`;
      const subscriptionId = await createSubscription(tokens, webhookUrl);
      
      // Update the account with the webhook subscription ID
      await db
        .update(connectorAccount)
        .set({ webhookSubscriptionId: subscriptionId, updatedAt: new Date() })
        .where(and(eq(connectorAccount.userId, userId), eq(connectorAccount.connectorId, 'microsoft-365')));
    } catch (webhookErr) {
      // Webhook setup failed, but OAuth succeeded - log but don't fail the connection
      console.error('Failed to set up Microsoft 365 webhook:', webhookErr);
    }

    return new Response(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ type: 'connector-connected', connectorId: 'microsoft-365', success: true }, window.location.origin);
          window.close();
        } else {
          window.location.href = '/settings/connectors?connected=microsoft-365';
        }
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (err) {
    return new Response(
      `<html><body><script>window.close();</script>Callback failed: ${String(err)}</body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }
}
