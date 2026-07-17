# Doc Expert

Enterprise document Q&A assistant with RAG (Retrieval-Augmented Generation) pipeline. Upload documents, ask questions in natural language, and get answers grounded in your documents with citations.

## Features

- **Document Upload & Processing** - Support for PDF, DOCX, and Markdown files with automatic chunking and embedding
- **RAG Chat Interface** - Natural language Q&A with streaming responses and source citations
- **Vector Search** - Semantic search powered by Qdrant vector database
- **Multiple LLM Providers** - Support for Ollama (local) and StreamLake (cloud) models
- **Conversation Management** - Persistent chat history with full CRUD operations
- **Authentication & RBAC** - Role-based access control (admin/editor/viewer/user)
- **GraphQL API** - Full-featured API with Relay-compatible schema
- **MCP Server** - Model Context Protocol integration for external tool access
- **Session Management** - Client-side session monitoring with auto-extension
- **Audit Logging** - Comprehensive action logging for compliance
- **Multi-Source Connectors** - Sync documents from Google Drive and Microsoft 365 via OAuth

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **UI**: Tailwind CSS 4, shadcn/ui, Lucide icons
- **Database**: SQLite with Drizzle ORM
- **Vector DB**: Qdrant
- **AI/ML**: LlamaIndex, Vercel AI SDK, Ollama, StreamLake
- **Auth**: Better Auth
- **API**: GraphQL (Pothos + Yoga), MCP SDK
- **Email**: Resend
- **Logging**: Pino

## Prerequisites

- Node.js 22+
- pnpm 9+
- Qdrant instance (local or remote)
- Ollama with embedding model (default: `dengcao/Qwen3-Embedding-0.6B:Q8_0`)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Initialize database

```bash
node scripts/init-db.mjs
```

### 3. Seed test accounts (optional)

```bash
node scripts/seed-accounts.mjs
```

### 4. Configure environment

Copy `.env.example` to `.env.local` and update:

```bash
cp .env.example .env.local
```

Key variables:
- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `LLM_MODEL` - Default completion model (default: `llama3.1:8b`)
- `EMBED_MODEL` - Embedding model (default: `dengcao/Qwen3-Embedding-0.6B:Q8_0`)
- `QDRANT_URL` - Qdrant server URL (default: `http://localhost:6333`)
- `BETTER_AUTH_SECRET` - Authentication secret
- `BETTER_AUTH_URL` - App URL (default: `http://localhost:3000`)
- `RESEND_API_KEY` - Resend API key for password reset emails

### Multi-Source Connectors

Connect external document sources (Google Drive, Microsoft 365) to automatically sync documents.

**1. Configure OAuth credentials** in `.env.local`:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**2. Set up OAuth consent screens:**

- **Google**: Create OAuth 2.0 credentials in Google Cloud Console. Add `http://localhost:3000/api/connectors/google-drive/callback` as an authorized redirect URI. Scope: `https://www.googleapis.com/auth/drive.readonly`.
- **Microsoft**: Register an app in Azure AD. Add `http://localhost:3000/api/connectors/microsoft-365/callback` as a redirect URI. Scopes: `Files.Read.All`, `Sites.Read.All`.

**3. Connect accounts** at `/settings/connectors` (accessible from the user menu).

**Sync behavior:**
- **Scheduled sync**: Runs hourly by default. Checks for new or modified documents.
- **Manual sync**: Click "Sync now" on any connected account.
- **Webhooks**: Real-time delta sync on document changes (requires public URL).
- **Deduplication**: Documents are keyed by `(userId, source, externalId)` — no duplicates across syncs.

### 5. Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - TypeScript type checking
- `pnpm format` - Format code with Prettier

## Project Structure

```
doc-expert/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── chat/          # Chat and streaming
│   │   ├── conversations/ # Conversation CRUD
│   │   ├── documents/     # Document management
│   │   ├── graphql/       # GraphQL endpoint
│   │   └── mcp/           # MCP server
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── profile/           # User profile
│   └── documents/         # Document viewer
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── ...               # Custom components
├── lib/                   # Shared libraries
│   ├── ai/               # LLM provider configuration
│   ├── auth/             # Better Auth setup
│   ├── db/               # Database schema and client
│   ├── graphql/          # GraphQL schema
│   └── llamaindex/       # RAG pipeline
├── hooks/                 # Custom React hooks
├── scripts/               # Database and seed scripts
└── e2e/                   # Playwright tests
```

## API Endpoints

### REST
- `POST /api/auth/[...all]` - Better Auth endpoints
- `POST /api/chat` - Stream chat responses
- `POST /api/documents/upload` - Upload documents (SSE progress)
- `GET /api/documents` - List documents
- `GET /api/conversations` - List conversations
- `POST /api/graphql` - GraphQL endpoint

### GraphQL
- `me` - Current user
- `conversations` - User's conversations (Relay connection)
- `conversation(id)` - Single conversation
- `documents` - List documents
- `searchDocuments(query, limit)` - Semantic search
- `createConversation(title)` - Create conversation
- `deleteConversation(id)` - Delete conversation

### MCP
- `document_search` - Search documents
- `list_documents` - List all documents

## Testing

```bash
# Run E2E tests
pnpm exec playwright test

# Run specific test
pnpm exec playwright test rag-flow
```

## Docker

Build and run with Docker:

```bash
docker build -t doc-expert .
docker run -p 3000:3000 --env-file .env doc-expert
```

## Enterprise Features

### Multi-Tenancy

Doc Expert supports multi-tenant deployments where each organization's data is fully isolated. All database records are scoped by `orgId`, and the middleware enforces organizational boundaries on every request. Users in one organization cannot access documents, conversations, or collections belonging to another.

- **Shared database, isolated data** — all tables include an `orgId` column; queries are scoped at the API and retrieval layers
- **Organization resolution** — the middleware attaches `X-Org-Id` to every authenticated request based on the user's organization membership
- **Cross-org access returns 404** — users see no indication that data outside their organization exists

### SSO Configuration

SAML 2.0 single sign-on is available for organizations that want centralized identity management.

**To configure SSO:**

1. Navigate to **Admin > SSO** (admin role required)
2. Select **SAML 2.0** as the protocol
3. Upload your IdP metadata XML file or paste the metadata URL
4. Configure auto-provisioning:
   - **Enabled** — new users who authenticate via SSO are automatically created with the default role
   - **Disabled** — SSO users must be pre-created by an admin
5. Set the **default role** for auto-provisioned users (viewer, editor, or admin)
6. Click **Test Connection** to validate the IdP metadata before saving
7. Click **Save** to enable SSO for your organization

Once SSO is enabled, users with matching email domains are automatically redirected to the IdP login page. The domain mapping is derived from the IdP metadata entity ID.

### Document Sharing Workflow

Document owners and admins can share documents with individuals or groups within their organization.

**To share a document:**

1. Open the document viewer
2. Click the **Share** button in the header
3. Search for a user by email or a group by name (org-scoped only)
4. Select a permission level: **Read**, **Write**, or **Admin**
5. Click **Add** to grant access

**Permission levels:**

| Level | Capabilities |
|-------|-------------|
| **Read** | View document, ask questions, see citations |
| **Write** | All read capabilities plus edit document metadata |
| **Admin** | All write capabilities plus grant/revoke permissions for others |

To revoke access, click the **Revoke** button next to any permission entry in the share dialog. The document's access control list is re-indexed immediately so retrieval reflects the change.

### Group Management

Groups allow admins to manage permissions at scale by assigning document access to a group rather than to individual users.

- **Create groups** at **Admin > Groups** — provide a name and optional description
- **Add members** from the group detail page by searching users within the organization
- **Remove members** individually; ACLs for all documents where the group has permission are updated automatically
- **Delete groups** — all permissions granted through the group are revoked and affected document ACLs are re-indexed

Groups are organization-scoped; members of one organization's groups cannot be shared with another organization.

## License

Private - not for distribution.
