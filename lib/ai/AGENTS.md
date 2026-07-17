# AI Provider Layer

## Purpose

AI model provider configuration and tool definitions for the application's AI capabilities.

## Ownership

- AI provider setup and configuration
- Tool definitions for AI function calling
- Model selection and parameter tuning

## Local Contracts

- Provider configured in `provider.ts`
- Tools defined in `tools.ts` for AI function calling
- Use the exported provider instance across the application
- Tools must have clear descriptions and typed parameters

## Work Guidance

### Key modules

- `provider.ts` - AI provider initialization (e.g., Ollama, OpenAI). Exports `getLLMAsync()` for async default model resolution from `systemConfig` table, and `getDefaultModel()` to read the configured default model.
- `tools.ts` - Tool definitions for AI-assisted operations

### Adding new tools

1. Define tool in `tools.ts` with clear name and description
2. Specify input schema with TypeScript types
3. Implement the tool's execution logic
4. Export the tool for use in AI calls

### Provider configuration

- Configure model endpoint, API keys, and parameters in `provider.ts`
- Support fallback models when primary is unavailable
- Log provider errors for debugging

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test AI provider connectivity
- Verify tool execution with sample inputs

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
