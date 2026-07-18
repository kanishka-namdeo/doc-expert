import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { user, document, conversation, collection } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

const logger = getLogger('api/admin/health');

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const [userCount] = await db.select({ count: count() }).from(user);
    const [docCount] = await db.select({ count: count() }).from(document);
    const [convCount] = await db.select({ count: count() }).from(conversation);
    const [collCount] = await db.select({ count: count() }).from(collection);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: {
        users: userCount?.count ?? 0,
        documents: docCount?.count ?? 0,
        conversations: convCount?.count ?? 0,
        collections: collCount?.count ?? 0,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
