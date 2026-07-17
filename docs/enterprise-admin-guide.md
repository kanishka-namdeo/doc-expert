# Enterprise Admin Guide

This guide covers administration of multi-tenancy, SSO, groups, and document sharing in Doc Expert.

## Prerequisites

- Admin role in your organization
- Access to the `/admin` section of the application

---

## Organizations

### How the Default Organization Works

On first initialization, Doc Expert creates a default organization with the slug `default`. All pre-existing users and data are assigned to this organization during the multi-tenancy migration.

- The default org cannot be deleted through the UI
- Users in the default org operate like any other organization
- The org slug is used in SSO routing (e.g., `/api/auth/sso/login?org=default`)

### Creating Additional Organizations

Organizations are created via the database or API. Each organization is identified by:

- **`id`** — auto-generated UUID
- **`name`** — human-readable organization name
- **`slug`** — unique URL-safe identifier (e.g., `acme-corp`)
- **`maxMembers`** — optional member limit

To create an organization:

1. Create the user account that will be the org admin
2. Insert an organization record into the `organization` table
3. Update the user's `orgId` to the new organization
4. The user can then manage SSO and groups for that organization

> **Note:** A UI for org creation is not yet available. Org creation is currently an admin/database operation.

---

## SSO Configuration

### SAML 2.0 Setup

Doc Expert supports SAML 2.0 for enterprise single sign-on. The SSO flow:

1. User enters their work email on the login page
2. The domain is matched against organizations with SSO enabled
3. User is redirected to the IdP's SSO URL
4. After authentication, the IdP posts a SAML assertion to the callback endpoint
5. The assertion is validated and the user is signed in

### Step-by-Step Configuration

**1. Navigate to the SSO admin page**

Go to **Admin > SSO**. You must have the admin role.

**2. Upload IdP metadata**

You can provide IdP metadata in one of two ways:

- **Upload XML file** — download the metadata XML from your IdP and upload it
- **Metadata URL** — enter the metadata URL provided by your IdP

The metadata must contain:
- Entity ID (used for domain mapping)
- SSO URL (binding `HTTP-Redirect` or `HTTP-POST`)
- Signing certificate (X.509)

**3. Configure auto-provisioning**

| Setting | Description |
|---------|-------------|
| **Auto-provisioning enabled** | New SSO users are automatically created on first login with the default role |
| **Auto-provisioning disabled** | Only pre-existing users can log in via SSO; new users see an access-denied page |
| **Default role** | Role assigned to auto-provisioned users: `viewer`, `editor`, or `admin` |

**4. Test the connection**

Click **Test Connection** to validate:
- The IdP metadata is well-formed XML
- The signing certificate is valid (not expired)
- The SSO URL is reachable

**5. Save the configuration**

Click **Save** to persist the configuration. The SSO settings are encrypted at rest using AES-256-GCM before being stored in the `organization.ssoConfig` column.

### IdP Configuration

Configure your IdP with the following Service Provider (SP) details:

| Property | Value |
|----------|-------|
| **Assertion Consumer Service (ACS) URL** | `{APP_URL}/api/auth/sso/callback` |
| **Entity ID (Audience URI)** | `{APP_URL}/api/auth/sso/metadata` |
| **NameID format** | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |
| **Binding** | `HTTP-Redirect` or `HTTP-POST` |

Required SAML attributes in the assertion:
- `email` (or `NameID` with email format) — used to match or create the user

### Testing SSO Connection

1. Click **Test Connection** in the SSO admin page
2. You will be redirected to your IdP login page
3. Authenticate with a test account
4. If successful, you are redirected back to the admin page with a success message
5. If it fails, the error message indicates whether the issue is with metadata, certificate, or assertion format

---

## Managing Groups

Groups are organization-scoped collections of users. They simplify permission management by allowing you to grant document access to a group rather than to individual users.

### Create a Group

1. Go to **Admin > Groups**
2. Click **New Group**
3. Enter a **name** (required) and **description** (optional)
4. Click **Create**

### Add Members to a Group

1. From the groups list, click the group name
2. Click **Add Member**
3. Search for users by email (org-scoped only)
4. Select the user and click **Add**

### Remove Members from a Group

1. From the group detail page, find the member in the list
2. Click **Remove** next to their name
3. Confirm the removal

When a member is removed, the access control lists for all documents where the group has permission are automatically re-indexed.

### Delete a Group

1. From the group detail page, click **Delete Group**
2. Confirm the deletion

**Cascade effects of group deletion:**
- All `documentPermission` records referencing the group are deleted
- All `groupMember` records for the group are deleted
- The ACL for every document that was shared with the group is re-indexed in Qdrant
- Users who had access only through this group lose access to those documents

---

## Document Sharing Workflows

### Share with Individuals

1. Open the document you want to share
2. Click the **Share** button in the top-right header
3. In the **Add people** field, type the user's email address
4. Select the user from the dropdown (only users in your organization appear)
5. Choose a permission level: **Read**, **Write**, or **Admin**
6. Click **Add**

The user immediately gains access and the document appears in their document list.

### Share with Groups

1. Open the document you want to share
2. Click the **Share** button
3. In the **Add people or groups** field, switch to the **Groups** tab
4. Search for the group by name
5. Select the group and choose a permission level
6. Click **Add**

All current and future members of the group gain access. When new members are added to the group, they automatically inherit access to all documents shared with the group.

### Permission Levels

| Level | Can view | Can chat | Can edit metadata | Can share with others | Can revoke permissions |
|-------|----------|----------|-------------------|----------------------|----------------------|
| **Read** | Yes | Yes | No | No | No |
| **Write** | Yes | Yes | Yes | No | No |
| **Admin** | Yes | Yes | Yes | Yes | Yes |

The document owner always has admin-level access and cannot have their own access revoked.

### Revoke Access

1. Open the **Share** dialog for the document
2. Find the user or group in the permissions list
3. Click the **Revoke** button (trash icon)
4. Confirm the revocation

The user immediately loses access. The document's ACL is re-indexed so retrieval queries from that user no longer return chunks from this document.

---

## Troubleshooting

### SSO Failures

**"Invalid SAML response"**
- The IdP certificate in the metadata may have changed. Re-upload the metadata XML from your IdP.
- Check that the system clock is synchronized; SAML assertions have strict time windows (default: 5-minute skew allowance).

**"User not found and auto-provisioning is disabled"**
- The user's email does not exist in the organization's user table.
- Either pre-create the user or enable auto-provisioning in the SSO settings.

**"SSO configuration not found for this domain"**
- The email domain entered on the login page does not match any organization with SSO enabled.
- Verify the organization's SSO config is saved and the entity ID domain matches.

**Redirect loop after SSO login**
- Check that the ACS URL in your IdP configuration exactly matches `{APP_URL}/api/auth/sso/callback`.
- Ensure the `BETTER_AUTH_URL` environment variable matches the URL your users access.

### Permission Issues

**User cannot see a shared document**
- Verify the permission was granted (check **Admin > Groups** if shared via group, or the Share dialog if shared individually)
- The user must be in the same organization — cross-org sharing is blocked
- If recently granted, wait a moment for the ACL to re-index (usually instant)

**User can see but cannot chat on a document**
- The user needs at least **Read** permission. Check the permission level in the Share dialog.

**Admin cannot revoke their own access**
- Document owners cannot revoke their own admin permission. This is enforced at the API layer.

### Cross-Org Access Problems

**User sees 403 on all API requests**
- The user's `orgId` may be NULL or invalid. Check the `user` table for the user's `orgId`.
- The middleware attaches `X-Org-Id` from the user record; if missing, all requests are rejected.

**User can see documents from another organization**
- This should not happen. Check that all API routes include the `orgId` filter. If you find a route that does not, it is a security bug — report it immediately.

**SSO user placed in wrong organization**
- The org is resolved from the `state` parameter in the SAML relay state. Ensure the login URL includes the correct `?org={slug}` parameter.

### Migration Issues

**Existing users lost access after multi-tenancy migration**
- Run `node scripts/migrate-multi-tenancy.mjs` to backfill `orgId` on all records.
- Verify all users have `orgId` set: `SELECT id, email, orgId FROM user WHERE orgId IS NULL;`

**Foreign key constraint failures during migration**
- The migration script creates the `organization` table first, then adds `orgId` columns, then backfills, then adds constraints. If you see FK errors, the backfill may have been interrupted. Re-run the migration on a fresh database copy.

**Qdrant points missing `orgId` after migration**
- Documents uploaded before the migration may have points in Qdrant without `orgId` in the payload. Re-ingest affected documents to populate the `orgId` and `accessControlList` fields.
