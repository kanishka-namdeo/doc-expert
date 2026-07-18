import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { and, eq, like } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/users/search');

export async function GET(
  request: NextRequest
) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ users: [] });
    }

    const query = q.trim();

    // Search users by email prefix within the same org, exclude current user
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      .from(user)
      .where(and(
        like(user.email, `${query}%`),
        eq(user.orgId, session.orgId)
      ))
      .limit(10);

    // Filter out current user
    const filtered = users.filter(u => u.id !== session.userId);

    return NextResponse.json({ users: filtered });
  } catch (error) {
    logger.error({ err: error }, 'Failed to search users');
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
