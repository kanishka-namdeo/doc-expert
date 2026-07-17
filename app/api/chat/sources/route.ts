import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/chat/sources');

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('sourceId');

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  try {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';

    // Use scroll with filter to ensure userId + orgId isolation
    const scrollResponse = await fetch(`${qdrantUrl}/collections/documents/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'orgId', match: { value: orgId } },
            { key: 'id', match: { value: sourceId } },
          ],
        },
        limit: 1,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!scrollResponse.ok) {
      throw new Error(`Failed to fetch source from Qdrant: ${scrollResponse.status}`);
    }

    const data = await scrollResponse.json();
    const points = data.result?.points || [];

    if (points.length === 0) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const point = points[0];

    return NextResponse.json({
      sourceId: point.id,
      text: point.payload?.text || '',
      fileName: point.payload?.fileName || '',
      chunkIndex: point.payload?.chunkIndex,
    });
  } catch (error) {
    logger.error({ err: error, sourceId }, 'Failed to fetch source');
    return NextResponse.json({ error: 'Failed to fetch source' }, { status: 500 });
  }
}
