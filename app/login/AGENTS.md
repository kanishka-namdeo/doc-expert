# Login Page

## Purpose

User authentication page. Supports email/password login and SSO.

## Ownership

- Login form component
- SSO domain check and redirect
- Session creation via Better Auth

## Local Contracts

- Public page (redirects authenticated users)
- Supports email/password and SSO login flows
- Uses `authClient` from `@/lib/auth/client` for browser auth operations
