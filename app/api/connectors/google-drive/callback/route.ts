import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/connectors/registry';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { connectorAccount } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const connector = getConnector('google-drive');

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

    // We need userId — in a popup flow, we can't easily get it from session.
    // The frontend should pass userId via state parameter or we use a different approach.
    // For now, store tokens and let the frontend associate them.
    // Actually, we need to handle this differently — let's use a session cookie approach.
    const session = await auth.api.getSession({ headers: request.headers });
    const isDev = process.env.NODE_ENV === 'development';
    const userId = session?.user?.id ?? (isDev ? 'dev-user' : null);

    if (!userId) {
      return new Response(
        '<html><body><script>window.close();</script>Not authenticated</body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    // Check if account already exists
    const existing = await db.query.connectorAccount.findFirst({
      where: (ca, { and, eq }) =>
        and(eq(ca.userId, userId), eq(ca.connectorId, 'google-drive')),
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
        connectorId: 'google-drive',
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

    // Close popup and signal success to opener
    return new Response(
      `<html><body><script>
        if (window.opener) {
          window.opener.postMessage({ type: 'connector-connected', connectorId: 'google-drive', success: true }, window.location.origin);
          window.close();
        } else {
          window.location.href = '/settings/connectors?connected=google-drive';
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
