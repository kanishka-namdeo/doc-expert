import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message, collection } from '@/lib/db/schema';
import { eq, like, and, desc, sql } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';
import type { SearchResponse } from '@/lib/types/search';

const logger = getLogger('api/search');

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.string().optional().default('20'),
  types: z.string().optional().default('all'),
});

export async function GET(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  try {
    const url = new URL(request.url);
    const { q, limit: limitStr, types } = querySchema.parse({
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || '20',
      types: url.searchParams.get('types') || 'all',
    });
    const limit = parseInt(limitStr, 10);
    const { userId, orgId } = session;
    const searchPattern = `%${q}%`;
    const typeFilter = types.split(',').map(t => t.trim());
    const searchAll = typeFilter.includes('all');

    const response: SearchResponse = {
      documents: [],
      conversations: [],
      collections: [],
      messages: [],
    };

    // Search documents
    if (searchAll || typeFilter.includes('documents')) {
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      try {
        const fetchResponse = await fetch(`${qdrantUrl}/collections/documents/points/scroll`, {
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

        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          const points = data.result?.points || [];

          const matchingPoints = points.filter((p: { payload?: { text?: string } }) =>
            p.payload?.text?.toLowerCase().includes(q.toLowerCase())
          );

          const seenDocs = new Set<string>();
          for (const point of matchingPoints) {
            const docId = point.payload?.documentId;
            if (docId && !seenDocs.has(docId) && response.documents.length < limit) {
              seenDocs.add(docId);
              response.documents.push({
                id: docId,
                type: 'document',
                title: point.payload?.fileName || 'Unknown',
                excerpt: point.payload?.text?.slice(0, 200),
                metadata: {
                  createdAt: point.payload?.uploadedAt ? new Date(point.payload.uploadedAt).toISOString() : new Date().toISOString(),
                  source: point.payload?.source,
                  similarity: point.payload?.score,
                },
              });
            }
          }
        }
      } catch {
        logger.warn({ query: q, userId }, 'Qdrant document search unavailable, skipping');
      }
    }

    // Search conversations by title
    if (searchAll || typeFilter.includes('conversations')) {
      const convs = await db
        .select({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
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

      for (const conv of convs) {
        response.conversations.push({
          id: conv.id,
          type: 'conversation',
          title: conv.title || 'Untitled',
          metadata: {
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString(),
          },
        });
      }
    }

    // Search collections
    if (searchAll || typeFilter.includes('collections')) {
      const cols = await db
        .select({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
        })
        .from(collection)
        .where(
          and(
            eq(collection.userId, userId),
            eq(collection.orgId, orgId),
            sql`(${collection.name} LIKE ${searchPattern} OR ${collection.description} LIKE ${searchPattern})`
          )
        )
        .orderBy(desc(collection.createdAt))
        .limit(limit);

      for (const col of cols) {
        response.collections.push({
          id: col.id,
          type: 'collection',
          title: col.name,
          excerpt: col.description || undefined,
          metadata: {
            createdAt: col.createdAt.toISOString(),
            updatedAt: col.updatedAt.toISOString(),
          },
        });
      }
    }

    // Search messages
    if (searchAll || typeFilter.includes('messages')) {
      const msgs = await db
        .select({
          id: message.id,
          conversationId: message.conversationId,
          content: message.content,
          createdAt: message.createdAt,
          conversationTitle: conversation.title,
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
        .orderBy(desc(message.createdAt))
        .limit(limit);

      const seenConvos = new Set<string>();
      for (const msg of msgs) {
        if (!seenConvos.has(msg.conversationId) && response.messages.length < limit) {
          seenConvos.add(msg.conversationId);
          let excerpt = '';
          try {
            const parts = JSON.parse(msg.content as string);
            if (Array.isArray(parts)) {
              const textParts = parts.filter((p: { type: string }) => p.type === 'text');
              excerpt = textParts.map((p: { type: string; text: string }) => p.text).join(' ').slice(0, 200);
            }
          } catch {
            excerpt = String(msg.content).slice(0, 200);
          }

          response.messages.push({
            id: msg.id,
            type: 'message',
            title: msg.conversationTitle || 'Untitled',
            excerpt,
            metadata: {
              createdAt: msg.createdAt.toISOString(),
            },
          });
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ err: error }, 'Search failed');
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
