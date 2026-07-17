import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/connectors/registry';
import { randomUUID } from 'node:crypto';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const isDev = process.env.NODE_ENV === 'development';
  if (!session && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
