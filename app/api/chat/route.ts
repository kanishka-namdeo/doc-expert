import { streamText } from 'ai';
import { llm } from '@/lib/ai/provider';
import { retrieveContext } from '@/lib/llamaindex/retriever';
import { documentSearchTool, listDocumentsTool } from '@/lib/ai/tools';
import type { UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: UIMessage[] };

  // Extract the last user message for retrieval
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const query = lastUserMessage?.parts
    ?.filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ') ?? '';

  // Retrieve relevant context from documents
  const { context, sources } = await retrieveContext(query);

  const systemPrompt = `You are Doc Expert, an enterprise document assistant. Answer questions using the provided context. Cite sources using [1], [2], etc. If the answer is not in the context, say "I don't have enough information."

Context:
${context || 'No relevant documents found.'}`;

  const modelMessages = messages.map(m => ({
    role: m.role,
    content: m.parts?.filter(p => p.type === 'text').map(p => p.text).join('') ?? '',
  }));
  const result = streamText({
    model: llm,
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      documentSearch: documentSearchTool,
      listDocuments: listDocumentsTool,
    },
  });

  // Append sources as metadata in the response
  return result.toTextStreamResponse();
}
