# Enterprise Multi-Tenancy, SSO & Document Access Control Design

**Date:** 2026-07-17  
**Status:** Draft  
**Scope:** Enterprise readiness features for Doc Expert sovereign AI platform

## Overview

This design adds enterprise-grade capabilities to Doc Expert: multi-tenancy with logical isolation, SSO integration for enterprise identity providers, and document-level access control for team collaboration. The design prioritizes sovereign/on-prem deployments where each customer typically runs their own instance, but the schema supports multi-org if needed.

## 1. Multi-Tenancy Foundation

### Architecture Decision
**Shared database with orgId filtering** — all organizations share one SQLite database, with every query filtered by `orgId`. This approach is simplest for sovereign deployments and works naturally with SQLite.

### Data Model Changes

**New table: `organization`**
```typescript
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ssoProvider: text('ssoProvider'),        // 'saml' | 'oidc' | null
  ssoConfig: text('ssoConfig'),            // encrypted JSON: IdP metadata, client secrets
  maxMembers: integer('maxMembers'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
```

**Schema updates — add `orgId` to:**
- `user` — user belongs to one org
- `document` — document scoped to org
- `conversation` — conversation scoped to org
- `message` — message inherits org from conversation
- `collection` — collection scoped to org
- `collectionDocument` — inherits org from collection
- `promptTemplate` — template scoped to org
- `connectorAccount` — connector scoped to org
- `auditLog` — audit event scoped to org

**Key decisions:**
- `organization.slug` used in URLs (`/org/acme/...`) and SSO callback routing
- `ssoConfig` stores encrypted IdP configuration per org (encrypted using `BETTER_AUTH_SECRET`)
- Existing `role` field on `user` stays for RBAC within org (admin/editor/viewer/user)
- Org admin is a user with `role = 'admin'` within their org

### Migration Strategy
1. Create `organization` table
2. Add `orgId` columns (nullable initially) to all affected tables
3. Create default org and backfill all existing data
4. Make `orgId` non-nullable after backfill
5. Add foreign key constraints

## 2. SSO Integration

### Supported Protocols
- **SAML 2.0** (primary — enterprise standard)
- **OIDC** (secondary — modern identity providers)

### Configuration Flow
1. Org admin navigates to `/admin/sso`
2. Selects protocol (SAML or OIDC)
3. Uploads IdP metadata (SAML) or enters client ID/issuer (OIDC)
4. Config is encrypted at rest and stored in `organization.ssoConfig`
5. Admin configures auto-provisioning policy (on/off, default role)

### Login Routing
**Email domain mapping** (recommended):
- User enters email on login page
- System extracts domain (`user@acme.com` → `acme`)
- If org exists with SSO configured, redirect to IdP
- Otherwise, fall back to email/password

**Alternative routing options:**
- Org selector dropdown on login page
- Org-specific login URL: `/login?org=acme` or `/org/acme/login`

### SSO Flow
1. User clicks "Sign in with SSO" (or auto-detected via email domain)
2. System generates SAML AuthnRequest / OIDC auth URL with org context
3. User authenticates with IdP
4. IdP redirects to `/api/auth/sso/callback` with assertion/code
5. System validates assertion, extracts user info (email, name)
6. Check if user exists in org:
   - **Exists:** Update last login, create session
   - **New:** Auto-provision user with default role (from org config), create session
7. Redirect to app

### API Routes
- `POST /api/auth/sso/login` — initiate SSO flow
- `POST /api/auth/sso/callback` — handle IdP callback
- `GET /api/admin/sso/config` — get org SSO config (admin only)
- `PUT /api/admin/sso/config` — update org SSO config (admin only)
- `DELETE /api/admin/sso/config` — disable SSO for org (admin only)

### Key Decisions
- Auto-provisioning: new SSO users get `user` role by default, org admin can promote
- Session duration inherits from org config or falls back to global default
- SSO can be disabled per org (fallback to email/password)
- SSO config encrypted at rest using `BETTER_AUTH_SECRET`

## 3. Document-Level Access Control

### Permission Model
Documents are owned by a user but can be shared with other users or groups within the same org.

**Permission levels:**
- `read` — view document, chat with document, download
- `write` — edit metadata, re-upload new version
- `admin` — share document, delete, manage permissions

**Permission sources (additive, highest wins):**
- Document owner (implicit full access)
- Direct user permission (via `documentPermission` table)
- Group permission (user is member of group with permission)

### Data Model

**New table: `documentPermission`**
```typescript
export const documentPermission = sqliteTable('document_permission', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull(),
  userId: text('userId'),            // null if granted via group
  groupId: text('groupId'),          // null if granted to individual
  permission: text('permission').notNull(), // 'read' | 'write' | 'admin'
  grantedBy: text('grantedBy').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});
```

**New table: `group`**
```typescript
export const group = sqliteTable('group', {
  id: text('id').primaryKey(),
  orgId: text('orgId').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
```

**New table: `groupMember`**
```typescript
export const groupMember = sqliteTable('group_member', {
  id: text('id').primaryKey(),
  groupId: text('groupId').notNull(),
  userId: text('userId').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});
```

### Retrieval Filter Changes

**Current:** Qdrant payload stores `userId`, filter by `userId`  
**New:** Qdrant payload stores `accessControlList` (array of user IDs with read access)

**Filter logic:**
```typescript
// Build ACL for document
const acl = [document.userId]; // owner
const permissions = await db.select().from(documentPermission)
  .where(eq(documentPermission.documentId, documentId));

for (const perm of permissions) {
  if (perm.userId) {
    acl.push(perm.userId);
  }
  if (perm.groupId) {
    const members = await db.select().from(groupMember)
      .where(eq(groupMember.groupId, perm.groupId));
    acl.push(...members.map(m => m.userId));
  }
}

// Store in Qdrant payload
payload.accessControlList = [...new Set(acl)];

// Retrieval filter
filter = {
  must: [
    { key: 'orgId', match: { value: orgId } },
    { key: 'accessControlList', match: { value: userId } }, // user in ACL
    { key: 'status', match: { value: 'approved' } }
  ]
}
```

### UI Changes

**Document detail page (`/documents/[id]`):**
- New "Share" tab
- Add users or groups with permission level dropdown
- Show current permissions (who has access)

**Document list page (`/documents`):**
- Filter tabs: "Owned by me" | "Shared with me" | "Shared by me"
- Access level indicator (icon or badge)

**Admin pages:**
- New `/admin/groups` page — CRUD for groups, manage members
- Group picker in document share dialog

### API Routes
- `POST /api/documents/[id]/permissions` — grant permission
- `DELETE /api/documents/[id]/permissions/[permId]` — revoke permission
- `GET /api/documents/[id]/permissions` — list permissions
- `POST /api/admin/groups` — create group
- `PUT /api/admin/groups/[id]` — update group
- `DELETE /api/admin/groups/[id]` — delete group
- `POST /api/admin/groups/[id]/members` — add member
- `DELETE /api/admin/groups/[id]/members/[userId]` — remove member

## 4. Middleware & Auth Guard

### Middleware Changes (`middleware.ts`)

**Org resolution flow:**
1. After session validation, look up user's `orgId` from `user` table
2. Attach `orgId` to request headers (`X-Org-Id`)
3. For SSO routes, resolve org from SSO callback state before session lookup

**Code pattern:**
```typescript
export default async function middleware(request: NextRequest) {
  // ... existing session validation ...
  
  if (isAuthenticated) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.id) {
      const user = await db.query.user.findFirst({
        where: eq(user.id, session.user.id)
      });
      if (user?.orgId) {
        request.headers.set('X-Org-Id', user.orgId);
      }
    }
  }
  
  // ... rest of middleware ...
}
```

### Auth Guard Pattern

**New helper in `lib/auth/rbac.ts`:**
```typescript
export async function requireOrg(session: Session, orgId: string) {
  if (session.user.orgId !== orgId) {
    throw new ForbiddenError('User does not belong to this organization');
  }
}

export async function getOrgId(request: Request): Promise<string> {
  const orgId = request.headers.get('X-Org-Id');
  if (!orgId) {
    throw new ForbiddenError('Organization not configured');
  }
  return orgId;
}
```

### API Route Changes

**Every route that touches user data:**
- Read `orgId` from `X-Org-Id` header (set by middleware)
- Pass `orgId` to all DB queries and Qdrant filters alongside `userId`
- Admin routes (`/api/admin/*`) get additional `requireAdmin()` check scoped to org

**Query pattern change:**
```typescript
// Before
db.select().from(document).where(eq(document.userId, userId))

// After
const orgId = await getOrgId(req);
db.select().from(document).where(
  and(eq(document.orgId, orgId), eq(document.userId, userId))
)
```

**Key decision:** Middleware owns org resolution. API routes never look up orgId themselves — they trust the header. This keeps the pattern consistent and avoids N+1 queries.

## 5. Error Handling & Edge Cases

### Error Scenarios

**Missing orgId on user:**
- Return 403 with "Organization not configured"
- Admin must assign user to org before they can access data

**SSO callback failure:**
- Redirect to `/login?error=sso_failed` with toast message
- Log error with full context for debugging

**Permission denied on document:**
- Return 404 (not 403) to avoid leaking document existence
- Message: "Document not found"

**Org deletion:**
- Cascade soft-delete — mark org as `disabled`, preserve data for 30-day grace period
- After grace period, hard-delete all org data

### Edge Cases

**User in no org:**
- Cannot create documents, conversations, or collections (all require orgId)
- Can view profile and change password
- Admin must assign org before user can access data features

**Cross-org sharing:**
- Explicitly forbidden — `documentPermission` table enforces same-org constraint via check
- Attempting to share with user from different org returns 400

**Orphaned documents after user leaves org:**
- Ownership transfers to org admin automatically
- Admin can reassign to another user or delete

**SSO user email changes:**
- If IdP changes user email, match by external ID (SAML NameID / OIDC sub) not email
- If no external ID match, create new user (old user becomes orphaned)

**Group deletion:**
- Revoke all permissions granted via group
- Documents remain accessible to owner and users with direct permissions

## 6. Testing Strategy

### E2E Tests (Playwright)
- **SSO login flow:** Mock SAML IdP, verify user auto-provisioning
- **Document sharing:** User A shares with User B, verify B can access
- **Group permissions:** Add user to group, verify group permissions apply
- **Cross-org isolation:** Verify User A cannot access User B's org data

### Unit Tests
- `requireOrg()` guard rejects cross-org access
- Permission resolution logic (direct + group permissions)
- ACL computation for Qdrant payload

### Integration Tests
- Qdrant filter returns only documents user has permission for
- SSO callback validates assertion and creates session
- Migration backfill script preserves data integrity

### Migration Tests
- Test backfill script on copy of production data
- Verify all existing data gets default orgId
- Verify non-nullable constraint applied after backfill

## 7. Implementation Phases

**Phase 1: Multi-tenancy foundation**
- Add `organization` table
- Add `orgId` to all tables
- Write migration script with backfill
- Update middleware to resolve orgId
- Update all API routes to filter by orgId

**Phase 2: SSO integration**
- Implement SAML 2.0 flow (login, callback, auto-provisioning)
- Build SSO config UI at `/admin/sso`
- Add email domain mapping on login page
- Test with mock IdP

**Phase 3: Document access control**
- Add `documentPermission`, `group`, `groupMember` tables
- Implement permission resolution logic
- Update Qdrant payload to include ACL
- Build share UI on document detail page
- Build group management UI at `/admin/groups`

**Phase 4: Testing & hardening**
- Write E2E tests for all flows
- Load test with multiple orgs
- Security review (cross-org access attempts)
- Documentation for org admins

## 8. Security Considerations

**Data isolation:**
- Every query must include orgId filter
- Defense in depth: middleware + API route + DB query all enforce org boundary
- Regular audits to ensure no queries miss org filter

**SSO security:**
- Validate SAML assertion signature against IdP certificate
- Validate OIDC ID token signature against issuer JWKS
- Reject assertions with expired timestamps
- Store IdP certificates/keys encrypted at rest

**Permission security:**
- Permission checks at API layer AND retrieval layer (Qdrant filter)
- Cannot bypass permissions by manipulating client-side state
- Audit log all permission changes

**Encryption:**
- SSO config encrypted at rest using `BETTER_AUTH_SECRET`
- Never log SSO config or tokens

## 9. Future Enhancements (Out of Scope)

- **Usage metering:** Per-org token quotas, rate limiting, billing hooks
- **Advanced audit:** Exportable audit trails, compliance reports (GDPR, SOC 2)
- **Multi-region:** Org data residency requirements
- **Org-level model config:** Each org configures their own LLM endpoints
- **Workspace hierarchy:** Teams within orgs with nested permissions

## 10. Open Questions

**Resolved:**
- ✅ Multi-tenancy model: Shared database with orgId filtering
- ✅ SSO protocol priority: SAML 2.0 first, OIDC second
- ✅ Login routing: Email domain mapping (auto-detect org from email)
- ✅ Permission model: Additive permissions, highest wins
- ✅ Default document access: Private (owner only), explicitly shared

**Deferred:**
- Org-level model config (future enhancement)
- Usage metering and billing (future enhancement)
- Advanced compliance reporting (future enhancement)
