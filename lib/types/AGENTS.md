# TypeScript Types

## Purpose

Shared TypeScript type definitions and interfaces used across the application.

## Ownership

- Application-wide type definitions
- Shared interfaces and enums
- Type utilities

## Local Contracts

- All exports must be explicitly typed
- Prefer interfaces over type aliases for object shapes
- Use const enums for fixed value sets
- Export types with descriptive names

## Work Guidance

- Keep types focused and single-purpose
- Co-locate related types in the same file
- Re-export from index.ts for convenient imports
