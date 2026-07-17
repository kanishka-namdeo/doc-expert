import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/connectors/registry';
import { randomUUID } from 'node:crypto';
import { getAuthSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const connectorId = request.nextUrl.searchParams.get('connectorId');
  if (!connectorId) {
    return NextResponse.json(
      { error: 'Missing connectorId parameter' },
      { status: 400 },
    );
  }

  const connector = getConnector(connectorId);
  if (!connector) {
    return NextResponse.json(
      { error: `Unknown connector: ${connectorId}` },
      { status: 404 },
    );
  }

  const state = randomUUID();
  const url = connector.getAuthUrl(state);

  return NextResponse.json({ url, state });
}
