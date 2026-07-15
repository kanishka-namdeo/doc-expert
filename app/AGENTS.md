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

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
