import { auth } from '@/lib/auth';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from 'ai';
import { retrieveContext } from '@/lib/llamaindex/retriever';
import { documentSearchTool, listDocumentsTool } from '@/lib/ai/tools';
import type { MyUIMessage } from '@/lib/types';
import { getLogger } from '@/lib/logger';
import { z } from 'zod';
import { getLLMAsync } from '@/lib/ai/provider';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/chat');

export async function POST(req: Request) {
  const session = await getAuthSession({ headers: req.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  try {
    const bodySchema = z.object({
      messages: z.array(z.object({
        role: z.string(),
        parts: z.array(z.object({
          type: z.string(),
          text: z.string().optional(),
        })).optional(),
        content: z.string().optional(),
      })),
      model: z.string().nullish(),
      conversationId: z.string().nullish(),
      collectionId: z.string().nullish(),
    });

    const parsed = bodySchema.parse(await req.json());
    const { messages, model: requestedModel, conversationId: providedConversationId, collectionId } = parsed;

    let activeConversationId = providedConversationId;

    // Auto-create conversation if not provided
    if (!activeConversationId) {
      const newConv = await db
        .insert(conversation)
        .values({
          id: crypto.randomUUID(),
          userId,
          orgId,
          title: 'New Conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      activeConversationId = newConv[0].id;
    }

    // Save user message to database
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      await db.insert(message).values({
        id: crypto.randomUUID(),
        conversationId: activeConversationId,
        orgId,
        role: 'user',
        content: JSON.stringify(lastUserMessage.parts),
        createdAt: new Date(),
      });
    }

    // Extract the last user message for retrieval
    const query = lastUserMessage?.parts
      ?.filter(p => p.type === 'text')
      .map(p => p.text ?? '')
      .join(' ') ?? lastUserMessage?.content ?? '';

    // Retrieve relevant context from documents (filtered by userId for isolation)
    // Gracefully handle retrieval failures (e.g., Qdrant unavailable)
    let context = '';
    let sources: Array<{ nodeId: string; fileName: string; text: string; score: number }> = [];
    try {
      const retrievalResult = await retrieveContext(query, 5, userId, collectionId ?? undefined);
      context = retrievalResult.context;
      sources = retrievalResult.sources;
    } catch (error) {
      logger.warn({ err: error, query, userId }, 'Retrieval failed, continuing without context');
      context = '';
      sources = [];
    }

    // Get model before logging (need it for audit)
    // Use || instead of ?? to handle empty strings from UI
    const selectedModel = requestedModel || process.env.LLM_MODEL || 'llama3.1:8b';

    await logAuditEvent(
      userId,
      'chat.query',
      'ai:chat',
      { queryLength: query.length, model: selectedModel, sourceCount: sources.length, orgId }
    );

    logger.info({ queryLength: query.length, sourceCount: sources.length }, 'Chat query processed');

    const systemPrompt = `You are Doc expert, an enterprise document assistant. Answer questions using the provided context.

IMPORTANT: You MUST cite sources using [1], [2], etc. immediately after each piece of information you use from the context. For example: "The embedding model is dengcao/Qwen3-Embedding-0.6B:Q8_0 [1]."

If the context contains enough information to answer the question, give a complete answer. If the context does NOT contain enough information, say ONLY "I don't have enough information to answer that question from the provided documents." Do NOT give a partial answer and then say you don't have enough information — choose one or the other.

Context:
${context || 'No relevant documents found.'}

After your answer, suggest 2-3 short follow-up questions the user might ask. Return them at the very end in this exact format (on a new line):
SUGGESTIONS:["question 1","question 2","question 3"]
Keep each under 60 characters. Do not include any other text after the SUGGESTIONS line.`;

    const modelMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.parts?.filter(p => p.type === 'text').map(p => p.text ?? '').join('') ?? m.content ?? '',
    }));

    // Use requested model (already declared above for audit logging)
    logger.info({ model: selectedModel }, 'Using model for chat');
    const llm = await getLLMAsync(selectedModel);

    // Create UI message stream with sources and metadata
    const stream = createUIMessageStream<MyUIMessage>({
      execute: ({ writer }) => {
        // Write transient search status
        if (sources.length > 0) {
          writer.write({
            type: 'data-searchStatus',
            data: {
              message: `Found ${sources.length} relevant sources`,
              level: 'info'
            },
            transient: true,
          });
        } else {
          writer.write({
            type: 'data-searchStatus',
            data: {
              message: 'No relevant sources found',
              level: 'warning'
            },
            transient: true,
          });
        }

        // Write source document parts (wire format)
        // Deduplicate by filename so the UI shows each document once
        const seenFiles = new Set<string>();
        sources.forEach((source) => {
          const key = source.fileName.toLowerCase();
          if (seenFiles.has(key)) return;
          seenFiles.add(key);
          writer.write({
            type: 'source-document',
            sourceId: source.nodeId,
            mediaType: 'application/pdf',
            title: source.fileName,
            filename: source.fileName,
          });
        });

        const result = streamText({
          model: llm,
          system: systemPrompt,
          messages: modelMessages,
          tools: sources.length > 0 ? undefined : {
            documentSearch: documentSearchTool(userId),
            listDocuments: listDocumentsTool(userId),
          },
        });

        // Merge the text stream with metadata
        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              if (part.type === 'start') {
                return {
                  createdAt: Date.now(),
                  model: selectedModel,
                  userId,
                  conversationId: activeConversationId,
                };
              }
              if (part.type === 'finish') {
                return {
                  totalTokens: part.totalUsage.totalTokens,
                };
              }
            },
          })
        );
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ err: error, userId, stack: errorStack }, 'Chat processing failed');
    return new Response(JSON.stringify({
      error: 'Chat processing failed',
      details: errorMessage,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
