# Authenticated Route Group

## Purpose

Route group for all pages requiring authentication. Wraps authenticated pages in the AppShell layout with sidebar navigation.

## Ownership

- AppShell layout (sidebar + main content area)
- Authenticated page routes (dashboard, documents, collections, templates, settings)
- Session validation at the layout level

## Local Contracts

- All routes in this group require a valid session
- Layout renders `AppShell` with sidebar navigation
- Pages receive authenticated user context

## Child DOX Index

- `admin/` - Admin pages (users, models, audit, groups, SSO, health)
- `collections/` - Document collection management
- `documents/[id]/` - Individual document viewing
- `profile/` - User profile management
- `settings/` - Application settings (connectors)
- `templates/` - Prompt template management
