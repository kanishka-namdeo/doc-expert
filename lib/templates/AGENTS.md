# Templates Module

## Purpose

Prompt template system for saving and reusing frequently asked questions.

## Ownership

- System default template definitions
- Template data types

## Local Contracts

- `defaults.ts` exports `DEFAULT_TEMPLATES` array of read-only system templates
- System templates are identified by `isSystem: true` and cannot be modified or deleted
- User templates are stored in the `promptTemplate` database table

## Work Guidance

### Adding new system templates

1. Add entry to `DEFAULT_TEMPLATES` in `defaults.ts`
2. Use a unique `id` prefixed with `sys-`
3. Assign an appropriate `category` (summary, analysis, search, custom)

## Child DOX Index

This directory has no nested subdirectories.
