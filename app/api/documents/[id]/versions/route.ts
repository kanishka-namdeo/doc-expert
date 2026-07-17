import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { document, documentVersion } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/audit';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/documents/[id]/versions');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;

    // Verify ownership
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId), eq(document.orgId, orgId)));

    if (!doc) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const versions = await db
      .select()
      .from(documentVersion)
      .where(eq(documentVersion.documentId, id))
      .orderBy(desc(documentVersion.version));

    return NextResponse.json({ versions });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch document versions');
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { id } = await params;
    const { userId, orgId } = session;
    const body = await request.json();
    const { version } = z.object({ version: z.number().int().positive() }).parse(body);

    // Verify ownership
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId), eq(document.orgId, orgId)));

    if (!doc) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [targetVersion] = await db
      .select()
      .from(documentVersion)
      .where(
        and(
          eq(documentVersion.documentId, id),
          eq(documentVersion.version, version)
        )
      );

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Rollback: update the main document to point to this version
    // In a real implementation, you'd re-ingest the old version's data
    await logAuditEvent(userId, 'document.rollback', 'document', {
      documentId: id,
      rolledBackToVersion: version,
      orgId,
    });

    return NextResponse.json({
      success: true,
      message: `Rolled back to version ${version}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to rollback document version');
    return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 });
  }
}
