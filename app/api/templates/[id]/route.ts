import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { promptTemplate } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/templates/[id]');

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;
    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      prompt: z.string().min(1).optional(),
      category: z.string().optional(),
    });
    const parsed = bodySchema.parse(await request.json());

    // Verify ownership
    const existingRows = await db
      .select()
      .from(promptTemplate)
      .where(and(eq(promptTemplate.id, id), eq(promptTemplate.userId, userId), eq(promptTemplate.orgId, orgId)));

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Template not found or access denied' }, { status: 404 });
    }
    const existing = existingRows[0];

    const updates: Record<string, unknown> = {};
    if (parsed.title !== undefined) updates.title = parsed.title;
    if (parsed.prompt !== undefined) updates.prompt = parsed.prompt;
    if (parsed.category !== undefined) updates.category = parsed.category;

    await db
      .update(promptTemplate)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promptTemplate.id, id));

    await logAuditEvent(
      userId,
      'template.update',
      'templates',
      { templateId: id, orgId }
    );

    logger.info({ templateId: id }, 'Template updated');
    return NextResponse.json({ ...existing, ...updates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to update template');
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const { id } = await params;

    // Verify ownership
    const existingRows = await db
      .select()
      .from(promptTemplate)
      .where(and(eq(promptTemplate.id, id), eq(promptTemplate.userId, userId), eq(promptTemplate.orgId, orgId)));

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Template not found or access denied' }, { status: 404 });
    }

    await db.delete(promptTemplate).where(and(eq(promptTemplate.id, id), eq(promptTemplate.orgId, orgId)));

    await logAuditEvent(
      userId,
      'template.delete',
      'templates',
      { templateId: id, orgId }
    );

    logger.info({ templateId: id }, 'Template deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete template');
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
