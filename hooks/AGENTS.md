# Hooks Directory

## Purpose

Custom React hooks for reusable stateful logic and side effects.

## Ownership

- Custom React hooks
- Shared hook utilities

## Local Contracts

- Hooks must follow React's Rules of Hooks
- Custom hooks must start with `use` prefix
- Return values should be clearly typed
- Document hook behavior and dependencies

## Work Guidance

- Keep hooks focused on a single concern
- Extract complex state logic into custom hooks
- Consider cleanup in `useEffect` hooks
- Test hooks with React Testing Library when complex

## Subagent Delegation

Use `frontend-specialist` subagent for all work in this directory. It owns React hook patterns, state management, and client-side logic conventions.

## Verification

- Run `pnpm typecheck` to ensure type safety
- Run `pnpm lint` to check code quality

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
