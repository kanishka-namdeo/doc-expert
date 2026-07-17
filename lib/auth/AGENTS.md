# Auth Module

## Purpose

Better Auth authentication layer with RBAC, session monitoring, and client-side auth helpers.

## Ownership

- Better Auth server configuration and adapter setup
- Role-based access control (RBAC) guards
- Client-side session monitoring and extension
- Auth client initialization for frontend use

## Local Contracts

- Server auth configured in `index.ts` with Drizzle SQLite adapter
- RBAC checks use `requireAdmin()` guard from `rbac.ts`
- Session monitor runs client-side polling via `session-monitor.ts`
- Client auth uses `authClient` from `client.ts` for browser operations

## Work Guidance

### Key modules

- `index.ts` - Better Auth server instance with email/password and session config
- `rbac.ts` - Role-based access control middleware (admin checks)
- `session-monitor.ts` - Client-side session expiry monitoring and auto-extension
- `client.ts` - Better Auth client for frontend API calls

### Adding RBAC roles

1. Define new role in database schema (`lib/db/schema.ts`)
2. Add role check function in `rbac.ts` following `requireAdmin()` pattern
3. Apply guard to protected API routes or server actions

### Session management

- Default session duration: 7 days (configurable in `index.ts`)
- Monitor warns at 5 minutes before expiry, expires at 0
- Extension endpoint: `/api/auth/extend-session`

## Subagent Delegation

Use `auth-specialist` subagent for all work in this directory. It owns Better Auth configuration, RBAC guards, session management, and security practices.

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test authentication flow with seeded test accounts
- Verify RBAC guards block unauthorized access
- Confirm session monitor triggers warnings correctly

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
