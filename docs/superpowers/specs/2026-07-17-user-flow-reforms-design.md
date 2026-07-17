# User Flow Reforms Design Spec

**Date:** July 17, 2026  
**Status:** Draft  
**Approach:** App Shell + Targeted Fixes (Approach A)

---

## Executive Summary

This spec addresses 22 identified issues across the doc-expert application, organized into three reform sections:

1. **Navigation Architecture** — Build persistent `AppShell` with role-aware sidebar navigation
2. **Critical Flow Fixes** — Repair broken interactions (group members, permission updates, document access)
3. **Consistency & Polish** — Standardize error handling, loading states, confirmations, and component usage

The root cause of most dead-end and inconsistency issues is the lack of a navigation shell. Building the shell and fixing flows together provides the best user outcome.

---

## Section 1: Navigation Architecture

### Problem Statement

No persistent navigation exists. Every page re-implements its own header and back button. Users get trapped in dead-end pages (Profile, Connectors, admin sub-pages). The `AppHeader` component is overloaded with chat-specific props but forced onto non-chat pages.

### Solution

Build an `AppShell` layout with role-aware sidebar navigation.

### Component Structure

```
components/
  app-shell.tsx          # Main layout wrapper
  app-sidebar.tsx        # Persistent sidebar nav
  page-header.tsx        # Generic page title + breadcrumb bar
```

### AppShell

- Wraps all authenticated pages
- Renders `AppSidebar` on the left (collapsible on mobile)
- Renders `<PageHeader>` at the top of the main content area
- Children render below the header

### AppSidebar

Two nav configurations based on user role:

**Regular user nav:**
- Chat (home)
- Documents
- Connectors
- Profile

**Admin nav (appended):**
- Admin Dashboard
- Users
- Groups
- Models
- SSO
- Audit Logs
- Health

### PageHeader

Replaces the overloaded `AppHeader` for non-chat pages:
- Title (from route or prop)
- Optional breadcrumb
- Optional action buttons (slot for page-specific actions)

### AppHeader Split

- Rename current `AppHeader` → `ChatHeader` (keeps model selector, collection picker, upload, document sheet)
- Only used on `/` (chat page)
- All other pages use `PageHeader` inside `AppShell`

### Migration

- Wrap all authenticated routes in `AppShell`
- Remove per-page back buttons
- Remove dead state variables from non-chat pages (the no-op callbacks)

---

## Section 2: Critical Flow Fixes

These are the broken interactions that the navigation shell alone doesn't solve.

### 2a. Group Member Sheet — Implement Member List

**Current state:** The member sheet shows only a count badge and says "Use the search above to add members." The `fetchMembers` function is a stub that sets `members = []`.

**Fix:**
- Implement `GET /api/admin/groups/[id]/members` endpoint — query `groupMember` table, join with `user` table, return member list
- Wire `fetchMembers()` to call this endpoint when the sheet opens
- Render the member list with name, email, and a remove button (currently only the add-via-search flow works)
- The remove button already exists in the code (`handleRemoveMember`) but is never rendered because the member list is empty

### 2b. Permission Level Change — Fix Revoke-and-Regrant

**Current state:** `handleUpdatePermission` in `DocumentShareDialog` revokes the old permission, then calls `fetchPermissions()` — it never re-grants with the new level. The function is dead code.

**Fix:**
- Add a permission level dropdown (Select) inline on each permission row, replacing the static Badge
- On change: call a `PUT /api/documents/[id]/permissions` endpoint (or revoke + regrant in sequence)
- Implement the server-side update: revoke old permission, grant new one with updated level
- Remove the separate `handleUpdatePermission` stub and replace with a working implementation

### 2c. Document Access from Chat

**Current state:** The document sheet in the chat header shows only "Owned by me" documents with no filter tabs and no link to the full `/documents` page. Users can't discover shared documents from the main chat view.

**Fix:**
- Add filter tabs (Owned / Shared with me / Shared by me) to the document sheet in `ChatHeader`, matching the `/documents` page
- Add a "View all documents" link at the bottom of the sheet that navigates to `/documents`
- Alternatively: replace the sheet with a direct link to `/documents` since the page already has full functionality

### 2d. "Shared by me" Access Badge

**Current state:** The "shared by me" filter hardcodes `accessLevel: 'owner'` for every document, making the badge column meaningless.

**Fix:**
- Query `documentPermission` for each granted document to get the actual recipient and permission level
- Return a richer response: `{ documentId, fileName, sharedWith: [{ email, permission }] }` or at minimum show the highest permission level granted
- Display a "Shared" badge with the count of people it's shared with, or show the top permission level

---

## Section 3: Consistency & Polish

These are the medium/low-severity issues that compound into a feeling of roughness.

### 3a. Error Handling Standardization

**Current state:** Five different error patterns across the app:
- `toast.success()` / `toast.error()` — groups page, document list
- Inline `<div className="text-destructive">` — login, admin pages
- `<Alert variant="destructive">` — SSO page, profile page
- `alert()` — profile data import
- `console.error()` — connectors page, chat page

**Fix:**
- Standardize on `toast()` from sonner for all transient success/error feedback
- Reserve inline error text for form validation (login, password change) where the error is tied to a specific field
- Reserve `<Alert>` for persistent page-level errors (e.g., "Access denied" on admin pages)
- Remove all `alert()` and `console.error()` calls from user-facing flows (replace with `logger.error()` server-side, `toast.error()` client-side)

### 3b. Destructive Action Confirmation

**Current state:**
- Document delete uses `window.confirm()`
- Group delete uses a proper `<Dialog>`
- SSO disable uses `window.confirm()`
- Connector disconnect uses `window.confirm()`
- Account delete uses a proper `<Dialog>`

**Fix:**
- Create a shared `ConfirmDialog` component (or reuse the existing pattern from groups)
- Use it for all destructive actions: document delete, group delete, SSO disable, connector disconnect, permission revoke
- Keep the inline `<Dialog>` for account deletion since it's a higher-stakes action that warrants its own dedicated confirmation

### 3c. Loading State Consistency

**Current state:**
- Admin/SSO pages: full-page "Loading..." text
- Connectors: inline spinner with text
- Documents: centered `Loader2` spinner
- Profile: no loading state at all
- Groups: centered `Loader2` spinner

**Fix:**
- Create a `PageLoading` component: centered `Loader2` with configurable message
- Use it for all initial page loads
- Use inline spinners only for partial loads (e.g., loading a list within a page)

### 3d. SSO Page Component Consistency

**Current state:**
- Auto-provisioning toggle uses a `<Button>` styled as a toggle instead of a `Switch`
- Default role uses a raw HTML `<select>` instead of shadcn `Select`

**Fix:**
- Replace the toggle button with `<Switch>` from shadcn/ui
- Replace the `<select>` with `<Select>` / `<SelectContent>` / `<SelectItem>`
- This matches the pattern used everywhere else in the app

### 3e. Profile Page Improvements

**Current state:**
- No way to edit name or email
- Data import uses `alert()` on success with no loading state
- No back navigation (dead end)

**Fix:**
- Add a "Personal Info" card with editable name field (email change requires admin or is disabled)
- Replace `alert()` with `toast.success()` for import
- Add loading state during import (button disabled + spinner)
- The navigation shell (Section 1) handles the dead-end issue

### 3f. Empty State Guidance

**Current state:** Empty document lists show plain text ("No documents uploaded yet") with no call-to-action.

**Fix:**
- On the `/documents` page, show an empty state with an upload button when "Owned by me" is empty
- On shared tabs, show text explaining how documents appear there ("Documents shared with you will appear here")
- Use a consistent empty state component with icon + text + optional CTA

### 3g. Login SSO Fallback Clarity

**Current state:** When SSO is detected, the "Use password instead" button implies a working fallback, but if the domain has SSO enforced, the password form will fail.

**Fix:**
- After the domain check, if SSO is enabled, hide the "Use password instead" option entirely
- Only show the password fallback if the domain check returns `ssoEnabled: false`
- Add a message: "Your organization uses single sign-on. Redirecting..."
- If the redirect stalls for more than 5 seconds, show a "Try again" button instead of a password form

### 3h. Document Viewer — Chunk Display

**Current state:** `/documents/[id]` renders individual RAG chunks as separate cards labeled "Chunk N". This is a developer view.

**Fix:**
- Concatenate chunks in order and render as a single continuous document
- Show chunk boundaries only as subtle dividers (optional, for debugging)
- Add a toggle: "View as document" (default) vs "View chunks" (for debugging)
- This makes the document viewer actually useful for end users reviewing their uploaded files

---

## Implementation Sequence

**Phase 1: Navigation Shell**
1. Create `AppShell`, `AppSidebar`, `PageHeader` components
2. Split `AppHeader` → `ChatHeader` + `PageHeader`
3. Migrate all authenticated routes to use `AppShell`
4. Remove per-page back buttons and dead state variables

**Phase 2: Critical Flow Fixes**
1. Implement group members list endpoint and UI
2. Fix permission level change (revoke + regrant)
3. Add filter tabs to chat document sheet
4. Fix "shared by me" access badge

**Phase 3: Consistency & Polish**
1. Standardize error handling to `toast()`
2. Create shared `ConfirmDialog` for destructive actions
3. Create `PageLoading` component
4. Fix SSO page component consistency
5. Add profile name editing
6. Improve empty states
7. Fix SSO login fallback
8. Improve document viewer chunk display

---

## Testing Strategy

- Verify navigation works on all authenticated routes
- Test role-based nav (admin vs regular user)
- Verify group member list loads and remove works
- Test permission level change end-to-end
- Verify document filters work from chat
- Test error handling across all flows
- Verify loading states are consistent
- Test SSO login flow with and without SSO enabled

---

## Out of Scope

- Connector sync engine improvements
- AI model management UI changes
- Audit log filtering enhancements
- GraphQL API changes
- Database schema migrations (beyond what's needed for group members)

---

## Success Criteria

- No dead-end pages (all pages have navigation)
- All destructive actions use proper confirmation dialogs
- Error handling is consistent (toast for transient, Alert for persistent)
- Loading states are consistent across all pages
- Group member management is fully functional
- Permission level changes work correctly
- Document access is discoverable from chat
- Document viewer shows documents, not raw chunks
