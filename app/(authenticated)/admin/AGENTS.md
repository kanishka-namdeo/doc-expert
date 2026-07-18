# Admin Pages

## Purpose

Administrative interface for system management. Requires admin role access.

## Ownership

- Admin dashboard and navigation
- User management pages
- System configuration pages

## Local Contracts

- All admin pages require admin role (enforced by RBAC)
- Pages are inside the `(authenticated)` route group
- Use server-side auth checks before rendering

## Child DOX Index

- `audit/` - Audit log viewer
- `documents/` - Document administration
- `groups/` - User group management
- `health/` - System health monitoring
- `models/` - AI model management (Ollama)
- `sso/` - SSO configuration
- `users/` - User account management
