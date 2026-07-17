# Doc Expert API Reference

## Authentication Endpoints

### POST /api/auth/login
Authenticate user and create session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "role": "user" },
  "session": { "token": "session-token", "expiresAt": 1234567890 }
}
```

### POST /api/auth/signup
Register new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

## Document Management

### POST /api/documents/upload
Upload and ingest document.

**Request:** multipart/form-data with `file` field

**Response:** Server-Sent Events stream with progress updates:
```
data: {"step":"parse","progress":10,"message":"Reading document..."}
data: {"step":"split","progress":30,"message":"Splitting into chunks..."}
data: {"step":"embed","progress":60,"message":"Generating embeddings..."}
data: {"step":"store","progress":90,"message":"Storing in vector database..."}
data: {"step":"complete","progress":100,"message":"Upload complete!"}
data: {"documentId":"uuid","chunkCount":42,"success":true}
```

**Supported Formats:**
- PDF (application/pdf)
- DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- Markdown (text/markdown)

**Size Limit:** 50MB maximum

### GET /api/documents
List user's documents.

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)
- `limit` (optional): Max results (default: 50)

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "fileName": "document.pdf",
      "mediaType": "application/pdf",
      "fileSize": 1234567,
      "status": "approved",
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### DELETE /api/documents/[id]
Delete document and associated vectors.

**Response:**
```json
{
  "success": true,
  "deletedChunks": 42
}
```

## Chat Endpoints

### POST /api/chat
Stream chat response with document context.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "parts": [{"type": "text", "text": "What is the embedding model?"}]
    }
  ],
  "model": "openbmb/minicpm5:q4_K_M",
  "conversationId": "uuid"
}
```

**Response:** Server-Sent Events stream:
```
data: {"type":"data-searchStatus","data":{"message":"Found 3 relevant sources","level":"info"}}
data: {"type":"source-document","sourceId":"uuid","title":"doc.pdf","filename":"doc.pdf"}
data: {"type":"text-delta","id":"abc","delta":"The"}
data: {"type":"text-delta","id":"abc","delta":" embedding"}
data: {"type":"text-delta","id":"abc","delta":" model"}
...
```

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "details": "Additional context (dev mode only)"
}
```

**Common Status Codes:**
- 400: Bad request (validation error)
- 401: Unauthorized (no session)
- 403: Forbidden (insufficient permissions)
- 404: Resource not found
- 500: Internal server error
