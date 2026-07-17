import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { promptTemplate } from '@/lib/db/schema';
import { DEFAULT_TEMPLATES } from '@/lib/templates/defaults';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/templates');

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    // Fetch user-created templates (org-scoped)
    let userTemplates: Array<{ id: string; title: string; prompt: string; category: string | null; isSystem: false }> = [];
    const rows = await db
      .select()
      .from(promptTemplate)
      .where(and(eq(promptTemplate.userId, userId), eq(promptTemplate.orgId, orgId)))
      .orderBy(desc(promptTemplate.createdAt));
    userTemplates = rows.map((row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      category: row.category,
      isSystem: false as const,
    }));

    // Merge with system defaults
    const systemTemplates = DEFAULT_TEMPLATES.map((t) => ({
      ...t,
      isSystem: true as const,
    }));

    const allTemplates = [...systemTemplates, ...userTemplates];

    return NextResponse.json({ templates: allTemplates });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list templates');
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const bodySchema = z.object({
      title: z.string().min(1),
      prompt: z.string().min(1),
      category: z.string().optional(),
    });
    const parsed = bodySchema.parse(await request.json());
    const { title, prompt, category } = parsed;

    const id = randomUUID();
    const now = new Date();

    await db.insert(promptTemplate).values({
      id,
      userId,
      orgId,
      title,
      prompt,
      category: category ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(
      userId,
      'template.create',
      'templates',
      { templateId: id, title, orgId }
    );

    logger.info({ templateId: id, title }, 'Template created');
    return NextResponse.json({ id, title, prompt, category, isSystem: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to create template');
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
