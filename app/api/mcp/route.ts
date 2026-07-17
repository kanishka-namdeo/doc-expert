import { auth } from '@/lib/auth';
import { retrieveContext } from '@/lib/llamaindex/retriever';
import { listDocuments } from '@/lib/llamaindex/documents';
import { getLogger } from '@/lib/logger';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/mcp');


export async function POST(req: Request) {
  // Validate session - require authentication
  const session = await getAuthSession({ headers: req.headers });
  if (session.error) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Unauthorized' } },
      { status: 401 }
    );
  }
  const { userId, orgId } = session;
  try {
    const body = await req.json();

    // Handle JSON-RPC 2.0 requests directly
    if (body.method === 'tools/list') {
      const tools = [
        {
          name: 'document_search',
          description: 'Search uploaded documents by semantic similarity',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
              topK: {
                type: 'number',
                description: 'Number of results to return (default: 5)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_documents',
          description: 'List all uploaded documents',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ];
      
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { tools },
      });
    }
    
    if (body.method === 'tools/call') {
      const { name, arguments: args } = body.params;
      
      if (name === 'document_search') {
        const query = args?.query;
        const topK = args?.topK;
        const { context, sources } = await retrieveContext(query, topK ?? 5, orgId, userId);
        
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ context, sources }, null, 2),
              },
            ],
          },
        });
      }
      
      if (name === 'list_documents') {
        const documents = await listDocuments(orgId, userId);
        
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ documents }, null, 2),
              },
            ],
          },
        });
      }
      
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Handle initialize request
    if (body.method === 'initialize') {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'doc-expert-mcp',
            version: '1.0.0',
          },
        },
      });
    }
    
    return Response.json({
      jsonrpc: '2.0',
      id: body.id,
      error: {
        code: -32601,
        message: 'Method not found',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'MCP request failed');
    return Response.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    });
  }
}
