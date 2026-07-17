import { requireAdmin } from '@/lib/auth/rbac';
import { db } from '@/lib/db';
import { systemConfig } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit';
import { getLogger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const logger = getLogger('api/admin/models/default');

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const rows = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'default_model'));

    const configValue = rows.length > 0 ? rows[0].value : (process.env.LLM_MODEL ?? 'llama3.1:8b');

    return NextResponse.json({ model: configValue });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get default model');
    return NextResponse.json({ error: 'Failed to get default model' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
  }

  try {
    const bodySchema = z.object({
      model: z.string().min(1),
    });
    const parsed = bodySchema.parse(await request.json());
    const { model } = parsed;

    const now = new Date();

    // Upsert into system_config
    const existing = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'default_model'));

    if (existing.length > 0) {
      await db
        .update(systemConfig)
        .set({ value: model, updatedAt: now })
        .where(eq(systemConfig.key, 'default_model'));
    } else {
      await db.insert(systemConfig).values({
        key: 'default_model',
        value: model,
        updatedAt: now,
      });
    }

    await logAuditEvent(
      adminResult.user.id,
      'model.default.set',
      'models',
      { model }
    );

    logger.info({ model }, 'Default model updated');
    return NextResponse.json({ model });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error({ err: error }, 'Failed to set default model');
    return NextResponse.json({ error: 'Failed to set default model' }, { status: 500 });
  }
}
