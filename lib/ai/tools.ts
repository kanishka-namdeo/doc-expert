import { z } from 'zod';
import { tool } from 'ai';
import { retrieveContext } from '@/lib/llamaindex/retriever';
import { listDocuments } from '@/lib/llamaindex/documents';

export const documentSearchTool = tool({
  description: 'Search uploaded documents by semantic similarity',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    topK: z.number().optional().describe('Number of results to return (default: 5)'),
  }),
  execute: async ({ query, topK }) => {
    const { context, sources } = await retrieveContext(query, topK ?? 5);
    return { context, sources };
  },
});

export const listDocumentsTool = tool({
  description: 'List all uploaded documents',
  inputSchema: z.object({}),
  execute: async () => {
    const documents = await listDocuments();
    return { documents };
  },
});
