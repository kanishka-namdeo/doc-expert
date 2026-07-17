# Doc Expert Troubleshooting Guide

## Common Issues

### Document Upload Fails

**Problem:** Upload returns 500 error with "no such table: document"

**Cause:** Database tables not initialized

**Solution:**
```bash
node scripts/init-db.mjs
```

Or run Drizzle migrations:
```bash
pnpm drizzle-kit push
```

### Chat Returns "No relevant sources found"

**Problem:** Documents uploaded but not found during retrieval

**Cause 1:** Document status is 'pending' instead of 'approved'

**Solution:** Documents are now auto-approved on upload. If using older version, approve via admin panel or update database:
```sql
UPDATE document SET status = 'approved' WHERE id = 'your-doc-id';
```

**Cause 2:** Qdrant points have wrong status

**Solution:** Update Qdrant payload:
```bash
curl -X POST http://localhost:6333/collections/documents/points/payload \
  -H "Content-Type: application/json" \
  -d '{"points":["point-id"],"payload":{"status":"approved"}}'
```

**Cause 3:** User ID mismatch

**Solution:** Verify document userId matches authenticated user. Check retrieval filter in `lib/llamaindex/retriever.ts`.

### Embedding Generation Timeout

**Problem:** Upload hangs at "Generating embeddings..."

**Cause 1:** Ollama not running

**Solution:**
```bash
ollama serve
```

**Cause 2:** Embedding model not pulled

**Solution:**
```bash
ollama pull dengcao/Qwen3-Embedding-0.6B:Q8_0
```

**Cause 3:** Large document with many chunks

**Solution:** Increase timeout or reduce chunk count:
```env
RETRIEVAL_TIMEOUT_MS=30000
PARENT_CHUNK_SIZE=2048
```

### LLM Response Quality Issues

**Problem:** LLM ignores context or gives wrong answers

**Cause 1:** Model not following instructions

**Solution:** Try different model:
```env
LLM_MODEL=llama3.1:8b
```

**Cause 2:** Context not retrieved properly

**Solution:** Check retrieval logs in `data/logs/app.log`. Verify Qdrant has documents with correct userId filter.

**Cause 3:** Prompt too long

**Solution:** Reduce top-k or chunk size:
```typescript
const retrievalResult = await retrieveContext(query, 3, userId); // was 5
```

### Authentication Errors

**Problem:** 401 Unauthorized on API calls

**Cause:** Session expired or invalid

**Solution:** Re-login or extend session:
```bash
curl -X POST http://localhost:3000/api/auth/extend-session
```

### Qdrant Connection Issues

**Problem:** "Failed to connect to Qdrant"

**Cause 1:** Qdrant not running

**Solution:**
```bash
docker start qdrant
```

**Cause 2:** Wrong URL in environment

**Solution:** Verify `QDRANT_URL` in `.env.local`

**Cause 3:** Collection doesn't exist

**Solution:** Collection is auto-created on first upload. Or manually create:
```bash
curl -X PUT http://localhost:6333/collections/documents \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":1024,"distance":"Cosine"}}'
```

## Debug Mode

Enable verbose logging:
```env
LOG_LEVEL=debug
```

Check logs:
```bash
tail -f data/logs/app.log
```

## Performance Issues

### Slow Document Upload

**Cause:** Large document or slow embedding generation

**Solutions:**
1. Reduce chunk size: `PARENT_CHUNK_SIZE=512`
2. Use faster embedding model
3. Increase batch size in `lib/llamaindex/ingest.ts`

### Slow Chat Responses

**Cause:** Retrieval taking too long

**Solutions:**
1. Reduce top-k: `retrieveContext(query, 3, userId)`
2. Use simpler retrieval mode: `RETRIEVAL_MODE=simple`
3. Increase timeout: `RETRIEVAL_TIMEOUT_MS=30000`

### High Memory Usage

**Cause:** Large documents or many concurrent users

**Solutions:**
1. Reduce chunk size
2. Limit concurrent uploads
3. Use streaming for large documents

## Getting Help

1. Check logs: `data/logs/app.log`
2. Verify all services running: Qdrant, Ollama, Next.js
3. Test endpoints individually with curl
4. Check database state: `sqlite3 data/db.sqlite ".tables"`
5. Verify Qdrant state: `curl http://localhost:6333/collections`
