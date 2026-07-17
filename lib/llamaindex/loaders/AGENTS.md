# Document Loaders

## Purpose

LlamaIndex document loaders for parsing and extracting text from different file formats during RAG ingestion.

## Ownership

- File format-specific document loaders
- Text extraction and preprocessing logic
- Format detection and loader selection

## Local Contracts

- Each loader handles a specific file format (PDF, DOCX, Markdown)
- Loaders return LlamaIndex Document objects with metadata
- Follow LlamaIndex loader interface conventions

## Work Guidance

### Key modules

- `pdf-loader.ts` - PDF document parsing and text extraction
- `docx-loader.ts` - Microsoft Word document parsing
- `markdown-loader.ts` - Markdown file parsing

### Adding new loaders

1. Create loader file following existing pattern
2. Implement LlamaIndex Document return type
3. Register loader in ingestion pipeline if needed

## Verification

- Run `pnpm typecheck` to ensure type safety
- Test loader with sample documents of each format
- Verify extracted text quality and metadata

## Child DOX Index

This directory has no nested subdirectories requiring separate DOX files.
