import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import RelayPlugin from '@pothos/plugin-relay';
import { db } from '@/lib/db';
import { user, conversation, message } from '@/lib/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { listDocuments, getDocumentsByIds } from '@/lib/llamaindex/documents';
import { retrieveContext } from '@/lib/llamaindex/retriever';
import type { DocumentInfo, Source as QdrantSource } from '@/lib/types/qdrant';
import type { GraphQLContext } from './context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('graphql');

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Objects: {
    User: typeof user.$inferSelect;
    Conversation: typeof conversation.$inferSelect;
    Message: typeof message.$inferSelect;
    Source: QdrantSource;
    Document: DocumentInfo;
    SearchResult: { chunks: Array<{ text: string; score: number; pageNumber?: number }>; document: DocumentInfo };
    SearchChunk: { text: string; score: number; pageNumber?: number };
  };
  Scalars: {
    DateTime: {
      Input: Date | string | number;
      Output: Date | string | number;
    };
  };
}>({
  plugins: [SimpleObjectsPlugin, RelayPlugin],
});

// Define DateTime scalar
builder.scalarType('DateTime', {
  serialize: (value: unknown) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return new Date(value).toISOString();
    return String(value);
  },
});

// User type
builder.objectRef<typeof user.$inferSelect>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    role: t.exposeString('role'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

// Conversation type
builder.objectRef<typeof conversation.$inferSelect>('Conversation').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    userId: t.exposeID('userId'),
    title: t.exposeString('title', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    messages: t.connection({
      type: 'Message',
      resolve: async (conv: typeof conversation.$inferSelect, args: { first?: number | null; after?: string | null }, ctx: GraphQLContext) => {
        const limit = args.first ?? 50;
        const after = args.after ? parseInt(args.after, 10) : 0;

        const msgs = await ctx.db
          .select()
          .from(message)
          .where(eq(message.conversationId, conv.id))
          .orderBy(desc(message.createdAt))
          .limit(limit + 1)
          .offset(after);

        const hasMore = msgs.length > limit;
        const edges = msgs.slice(0, limit).map((msg: typeof message.$inferSelect, idx: number) => ({
          cursor: String(after + idx),
          node: msg,
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: hasMore,
            hasPreviousPage: after > 0,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges[edges.length - 1]?.cursor ?? null,
          },
        };
      },
    }),
  }),
});

// Message type
builder.objectRef<typeof message.$inferSelect>('Message').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    conversationId: t.exposeID('conversationId'),
    role: t.exposeString('role'),
    content: t.exposeString('content'),
    metadata: t.exposeString('metadata', { nullable: true }),
    sources: t.field({
      type: ['Source'],
      resolve: (msg: typeof message.$inferSelect) => {
        if (!msg.metadata) return [];
        try {
          const parsed = JSON.parse(msg.metadata);
          return parsed.sources || [];
        } catch {
          return [];
        }
      },
    }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

// Source type (for RAG citations)
builder.objectRef<QdrantSource>('Source').implement({
  fields: (t) => ({
    text: t.exposeString('text'),
    fileName: t.exposeString('fileName'),
    score: t.exposeFloat('score'),
    nodeId: t.exposeString('nodeId'),
  }),
});

// Document type (from external storage, not in DB schema)
builder.objectRef<DocumentInfo>('Document').implement({
  fields: (t) => ({
    id: t.exposeID('documentId'),
    filename: t.exposeString('fileName'),
    uploadedAt: t.exposeString('uploadedAt'),
    chunkCount: t.exposeInt('chunkCount'),
  }),
});

// SearchResult type for document search
builder.objectRef<{ chunks: Array<{ text: string; score: number; pageNumber?: number }>; document: DocumentInfo }>('SearchResult').implement({
  fields: (t) => ({
    chunks: t.field({
      type: ['SearchChunk'],
      resolve: (result: { chunks: Array<{ text: string; score: number; pageNumber?: number }>; document: DocumentInfo }) => result.chunks,
    }),
    document: t.expose('document', { type: 'Document' }),
  }),
});

builder.objectRef<{ text: string; score: number; pageNumber?: number }>('SearchChunk').implement({
  fields: (t) => ({
    text: t.exposeString('text'),
    score: t.exposeFloat('score'),
    pageNumber: t.exposeInt('pageNumber', { nullable: true }),
  }),
});

// Query root
builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: 'User',
      resolve: (_: unknown, _args: Record<string, never>, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        return ctx.loaders.userById.load(ctx.userId);
      },
    }),
    conversations: t.connection({
      type: 'Conversation',
      resolve: async (_: unknown, args: { first?: number | null; after?: string | null }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        const limit = args.first ?? 20;
        const after = args.after ? parseInt(args.after, 10) : 0;

        const convs = await ctx.db
          .select()
          .from(conversation)
          .where(eq(conversation.userId, ctx.userId))
          .orderBy(desc(conversation.updatedAt))
          .limit(limit + 1)
          .offset(after);

        const hasMore = convs.length > limit;
        const edges = convs.slice(0, limit).map((conv: typeof conversation.$inferSelect, idx: number) => ({
          cursor: String(after + idx),
          node: conv,
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: hasMore,
            hasPreviousPage: after > 0,
            startCursor: edges[0]?.cursor ?? null,
            endCursor: edges[edges.length - 1]?.cursor ?? null,
          },
        };
      },
    }),
    conversation: t.field({
      type: 'Conversation',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        const rows = await ctx.db
          .select()
          .from(conversation)
          .where(and(eq(conversation.id, id), eq(conversation.userId, ctx.userId)));
        return rows[0] || null;
      },
    }),
    documents: t.field({
      type: ['Document'],
      resolve: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        if (!ctx.orgId) return [];
        try {
          return await listDocuments(ctx.orgId, ctx.userId);
        } catch (error) {
          logger.error({ error }, 'Failed to list documents');
          return [];
        }
      },
    }),
    searchDocuments: t.field({
      type: ['SearchResult'],
      args: { 
        query: t.arg.string({ required: true }), 
        limit: t.arg.int({ defaultValue: 5 }) 
      },
      resolve: async (_: unknown, args: { query: string; limit?: number | null }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        const limit = args.limit ?? 5;
        try {
          const { sources } = await retrieveContext(args.query, limit, ctx.userId);
          
          // Group sources by document
          const docMap = new Map<string, { chunks: Array<{ text: string; score: number }>; docInfo: DocumentInfo | null }>();
          
          for (const source of sources) {
            const docId = source.nodeId.split('_')[0]; // Extract document ID from nodeId
            if (!docMap.has(docId)) {
              docMap.set(docId, { chunks: [], docInfo: null });
            }
            const entry = docMap.get(docId)!;
            entry.chunks.push({ text: source.text, score: source.score });
          }
          
          // Batch fetch all documents by their IDs in a single operation
          const docIds = Array.from(docMap.keys());
          const docsById = await getDocumentsByIds(docIds, ctx.orgId ?? '', ctx.userId);
          
          // Map results to documents without N+1 queries
          const results: Array<{ chunks: Array<{ text: string; score: number }>; document: DocumentInfo }> = [];
          for (const [docId, entry] of docMap) {
            const docInfo = docsById.get(docId);
            if (docInfo) {
              results.push({ chunks: entry.chunks, document: docInfo });
            }
          }
          
          return results;
        } catch (error) {
          logger.error({ error }, 'Failed to search documents');
          return [];
        }
      },
    }),
  }),
});

// Mutation root
builder.mutationType({
  fields: (t) => ({
    createConversation: t.field({
      type: 'Conversation',
      args: { title: t.arg.string({ required: true }) },
      resolve: async (_: unknown, { title }: { title: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        const now = new Date();
        const newConv = await ctx.db
          .insert(conversation)
          .values({
            id: crypto.randomUUID(),
            userId: ctx.userId,
            title: title || 'New Conversation',
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return newConv[0] ?? null;
      },
    }),
    deleteConversation: t.field({
      type: 'Boolean',
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
        if (!ctx.userId) throw new Error('Unauthorized');
        // Delete messages first (no FK cascade in SQLite)
        await ctx.db.delete(message).where(eq(message.conversationId, id));
        // Then delete conversation
        const result = await ctx.db
          .delete(conversation)
          .where(and(eq(conversation.id, id), eq(conversation.userId, ctx.userId)));
        return true;
      },
    }),
  }),
});

export const schema = builder.toSchema();
