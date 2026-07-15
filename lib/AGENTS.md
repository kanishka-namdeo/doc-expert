# Lib Directory

## Purpose

Shared utility functions and library code used across the application.

## Ownership

- Utility functions (e.g., `cn()` for class merging)
- Helper modules and shared logic
- Third-party library wrappers

## Local Contracts

- All exports must be typed with TypeScript
- Functions should be pure when possible
- Document complex utilities with JSDoc comments

## Work Guidance

- Keep utilities focused and single-purpose
- Prefer small, composable functions over large monolithic ones
- Export named functions, not default exports
- Include type definitions for all parameters and return values

## Verification

- Run `pnpm typecheck` to ensure type safety
- Run `pnpm lint` to check code quality

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
