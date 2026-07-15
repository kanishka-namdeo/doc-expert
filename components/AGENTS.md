# Components Directory

## Purpose

React component library. Contains shadcn/ui components and custom application components.

## Ownership

- UI component primitives (shadcn/ui)
- Theme provider and theme switching logic
- Application-specific composite components

## Local Contracts

- Components use TypeScript with explicit prop types
- shadcn/ui components live in `components/ui/` and are managed via CLI
- Client components must include `"use client"` directive at the top
- Use `cn()` utility from `@/lib/utils` for conditional class merging

## Work Guidance

### Adding shadcn/ui components

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `components/ui/` and imported as:

```tsx
import { Button } from "@/components/ui/button"
```

### Component conventions

- Prefer composition over prop drilling
- Use Radix UI primitives (via shadcn) for accessible components
- Keep components focused and single-responsibility
- Document complex props with TypeScript interfaces

## Verification

- Run `pnpm typecheck` to ensure type safety
- Run `pnpm lint` to check code quality
- Test components in isolation when complex

## Child DOX Index

- `ui/` - shadcn/ui component primitives (managed via CLI, no separate DOX needed)
