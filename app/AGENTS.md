# App Directory

## Purpose

Next.js App Router implementation. Contains pages, layouts, and global styles.

## Ownership

- Route definitions and page components
- Root layout with theme provider
- Global CSS and styling configuration

## Local Contracts

- All pages must be exported as default functions
- Server Components are the default; use `"use client"` directive only when needed
- Layout wraps all pages in the directory and receives `children` prop

## Work Guidance

- Pages: `page.tsx` files define route content
- Layouts: `layout.tsx` files define shared UI structure
- Global styles: `globals.css` for Tailwind directives and CSS variables
- Fonts: configured via Next.js font optimization in root layout

## Verification

- Run `pnpm dev` and verify pages render
- Run `pnpm typecheck` to ensure type safety
- Run `pnpm lint` to check code quality

## Testing

### Test Accounts

Four pre-seeded test accounts are available for authentication testing. See `skill://test-accounts` for credentials and usage patterns.

- **Admin**: Full access, user management
- **Editor**: Document upload and editing
- **Viewer**: Read-only document access
- **User**: General feature testing

Run `node scripts/seed-accounts.mjs` to create or reset test accounts. All passwords use bcrypt hashing compatible with Better Auth.
## Subagent Delegation

Use `frontend-specialist` subagent for page and layout work in this directory. For API routes under `app/api/`, use `api-specialist` instead. For auth-related pages (`login`, `signup`, `forgot-password`, `reset-password`), coordinate with `auth-specialist`.

## Child DOX Index

- `api/` - Next.js API routes (auth, chat, documents, MCP, users, admin, collections, templates)
- `admin/models/` - On-prem model management page
- `documents/[id]/` - Document viewing pages
- `forgot-password/` - Password recovery flow
- `login/` - User authentication page
- `profile/` - User profile management
- `reset-password/` - Password reset flow
- `signup/` - User registration page
