# Doc Expert Technical Architecture

## System Overview

Doc Expert is an enterprise document assistant built on Next.js 15 with TypeScript. The system provides intelligent document search, analysis, and Q&A capabilities using Retrieval-Augmented Generation (RAG).

## Core Components

### Frontend Layer
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19 with Server Components
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query for server state
- **Real-time**: Server-Sent Events for streaming responses

### Backend Layer
- **API Routes**: Next.js App Router API endpoints
- **Authentication**: Better Auth with session-based auth
- **Database**: SQLite with Drizzle ORM
- **Vector Store**: Qdrant for semantic search

### AI/ML Layer
- **LLM Provider**: Ollama (local) or StreamLake (cloud)
- **Embedding Model**: dengcao/Qwen3-Embedding-0.6B:Q8_0
- **Default LLM**: openbmb/minicpm5:q4_K_M
- **Framework**: LlamaIndex for RAG pipeline

## Data Flow

1. **Document Ingestion**
   - User uploads PDF, DOCX, or Markdown
   - Document parsed and split into chunks
   - Embeddings generated via Qwen3 model
   - Vectors stored in Qdrant with metadata

2. **Query Processing**
   - User submits question via chat interface
   - Query embedded using same model
   - Similar vectors retrieved from Qdrant
   - Context assembled and sent to LLM
   - Response streamed back with citations

## Security Model

- Role-based access control (RBAC)
- Document-level user isolation
- Session-based authentication
- Audit logging for all operations

## Performance Characteristics

- Chunk size: 1024 tokens (parent), 256 tokens (child)
- Embedding dimension: 1024
- Retrieval top-k: 5 documents
- Similarity threshold: 0.1 (cosine)
- Query timeout: 15 seconds
