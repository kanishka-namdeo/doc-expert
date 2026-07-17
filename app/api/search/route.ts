import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message, user } from '@/lib/db/schema';
import { eq, like, or, and, desc } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/search');

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.string().optional().default('10'),
  type: z.enum(['all', 'conversations', 'documents']).optional().default('all'),
});

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const url = new URL(request.url);
    const { q, limit: limitStr, type } = querySchema.parse({
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || '10',
      type: url.searchParams.get('type') || 'all',
    });
    const limit = parseInt(limitStr, 10);
    const { userId, orgId } = session;
    const searchPattern = `%${q}%`;

    const results: Array<{
      type: string;
      id: string;
      title: string;
      snippet?: string;
      createdAt: Date | number;
    }> = [];

    if (type === 'all' || type === 'conversations') {
      // Search conversations by title
      const convs = await db
        .select({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
        })
        .from(conversation)
        .where(
          and(
            eq(conversation.userId, userId),
            eq(conversation.orgId, orgId),
            like(conversation.title, searchPattern)
          )
        )
        .orderBy(desc(conversation.createdAt))
        .limit(limit);

      // Also search message content
      const msgs = await db
        .select({
          conversationId: message.conversationId,
          content: message.content,
        })
        .from(message)
        .innerJoin(conversation, eq(message.conversationId, conversation.id))
        .where(
          and(
            eq(conversation.userId, userId),
            eq(conversation.orgId, orgId),
            like(message.content, searchPattern)
          )
        )
        .limit(limit);

      for (const conv of convs) {
        results.push({
          type: 'conversation',
          id: conv.id,
          title: conv.title || 'Untitled',
          createdAt: conv.createdAt,
        });
      }

      // Deduplicate messages by conversation
      const seenConvos = new Set(convs.map((c) => c.id));
      for (const msg of msgs) {
        if (!seenConvos.has(msg.conversationId)) {
          seenConvos.add(msg.conversationId);
          // Get conversation title
          const [conv] = await db
            .select({ title: conversation.title })
            .from(conversation)
            .where(eq(conversation.id, msg.conversationId));

          let snippet = '';
          try {
            const parts = JSON.parse(msg.content as string);
            if (Array.isArray(parts)) {
              const textParts = parts.filter((p: any) => p.type === 'text');
              snippet = textParts.map((p: any) => p.text).join(' ').slice(0, 200);
            }
          } catch {
            snippet = String(msg.content).slice(0, 200);
          }

          results.push({
            type: 'conversation',
            id: msg.conversationId,
            title: conv?.title || 'Untitled',
            snippet,
            createdAt: new Date(),
          });
        }
      }
    }

    if (type === 'all' || type === 'documents') {
      // Search documents via Qdrant
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      try {
        const response = await fetch(`${qdrantUrl}/collections/documents/points/scroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filter: {
              must: [
                { key: 'orgId', match: { value: orgId } },
                { key: 'status', match: { value: 'approved' } },
                { key: 'accessControlList', match: { value: userId } },
              ],
            },
            limit,
            with_payload: true,
            with_vector: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const points = data.result?.points || [];

          // Filter points whose text contains the query
          const matchingPoints = points.filter((p: any) =>
            p.payload?.text?.toLowerCase().includes(q.toLowerCase())
          );

          const seenDocs = new Set<string>();
          for (const point of matchingPoints) {
            const docId = point.payload?.documentId;
            if (docId && !seenDocs.has(docId)) {
              seenDocs.add(docId);
              results.push({
                type: 'document',
                id: docId,
                title: point.payload?.fileName || 'Unknown',
                snippet: point.payload?.text?.slice(0, 200),
                createdAt: point.payload?.uploadedAt || 0,
              });
            }
          }
        }
      } catch {
        // Qdrant unavailable, skip document search
        logger.warn({ query: q, userId: session.session?.user.id }, 'Qdrant document search unavailable, skipping');
      }
    }

    return NextResponse.json({ results, query: q, count: results.length });
  } catch (error) {
    logger.error({ err: error }, 'Search failed');
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
