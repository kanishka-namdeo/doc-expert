# Enterprise Multi-Tenancy, SSO & Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenancy (shared DB with orgId), SAML 2.0 SSO, and document-level access control to Doc Expert.

**Architecture:** Shared SQLite database with orgId filtering on all user data. Middleware resolves orgId from session and attaches to request headers. SSO via SAML 2.0 with auto-provisioning. Document permissions via ACL stored in Qdrant payload.

**Tech Stack:** Next.js 16, Drizzle ORM, Better Auth (SAML plugin), Qdrant, Pino

## Global Constraints

- All queries on user data must include orgId filter
- SSO config encrypted at rest using BETTER_AUTH_SECRET
- Permission denied returns 404 (not 403) to avoid leaking document existence
- Middleware owns org resolution — API routes trust X-Org-Id header
- Users without orgId cannot create data (empty state only)
- Orphaned documents transfer to org admin on user removal
- Existing role field (admin/editor/viewer/user) stays for RBAC within org
- Follow DOX framework: read AGENTS.md chain before editing
- Use pino logger, never console.log
- Run pnpm typecheck and pnpm lint after changes
