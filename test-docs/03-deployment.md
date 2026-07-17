# Doc Expert Deployment Guide

## Prerequisites

### System Requirements
- Node.js 20 or higher
- pnpm package manager
- Docker (for Qdrant)
- Ollama (for local LLM)

### Hardware Recommendations
- **CPU**: 4+ cores for embedding generation
- **RAM**: 16GB minimum (32GB recommended)
- **Storage**: 10GB+ for vector database
- **GPU**: Optional but recommended for faster embeddings

## Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/your-org/doc-expert.git
cd doc-expert
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment
Create `.env.local`:
```env
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
OLLAMA_URL=http://localhost:11434
LLM_MODEL=openbmb/minicpm5:q4_K_M
EMBED_MODEL=dengcao/Qwen3-Embedding-0.6B:Q8_0
QDRANT_URL=http://localhost:6333
BETTER_AUTH_SECRET=your-secret-key-here
```

### 4. Start Qdrant
```bash
docker run -d -p 6333:6333 -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### 5. Initialize Database
```bash
node scripts/init-db.mjs
```

### 6. Seed Test Accounts (Optional)
```bash
node scripts/seed-accounts.mjs
```

### 7. Start Development Server
```bash
pnpm dev
```

Application will be available at http://localhost:3000

## Production Deployment

### Build Application
```bash
pnpm build
```

### Start Production Server
```bash
pnpm start
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong `BETTER_AUTH_SECRET` (32+ characters)
- Configure proper `QDRANT_URL` for your deployment
- Set up persistent storage for SQLite database

## Troubleshooting

### Port Already in Use
If port 3000 is occupied, Next.js will automatically use the next available port (3001, 3002, etc.).

### Qdrant Connection Failed
Verify Qdrant is running:
```bash
curl http://localhost:6333/collections
```

### Embedding Model Not Found
Pull the model in Ollama:
```bash
ollama pull dengcao/Qwen3-Embedding-0.6B:Q8_0
```

### Database Errors
Re-run initialization:
```bash
node scripts/init-db.mjs
```

## Performance Tuning

### Chunk Size Configuration
Edit environment variables:
```env
PARENT_CHUNK_SIZE=1024
CHILD_CHUNK_SIZE=256
CHILD_CHUNK_OVERLAP=32
```

### Retrieval Settings
```env
RETRIEVAL_MODE=simple  # or 'layered' or 'agentic'
RETRIEVAL_TIMEOUT_MS=15000
```

### Qdrant Optimization
- Increase `max_optimization_threads` in Docker
- Use SSD storage for vector database
- Monitor collection size with `/collections` endpoint
