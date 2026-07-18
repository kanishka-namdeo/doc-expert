import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { document, user } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';

const logger = getLogger('api/admin/documents');

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const docs = await db
      .select({
        id: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mediaType: document.mediaType,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        userId: document.userId,
        userEmail: user.email,
      })
      .from(document)
      .leftJoin(user, eq(document.userId, user.id))
      .orderBy(desc(document.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(document);

    return NextResponse.json({
      documents: docs,
      pagination: {
        page,
        limit,
        total: countResult?.count ?? 0,
        totalPages: Math.ceil((countResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch documents');
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
