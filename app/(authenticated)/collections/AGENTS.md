# Collections

## Purpose

Document collection management. Users create collections to organize documents for scoped Q&A.

## Ownership

- Collection list page
- Collection detail page with document management
- Collection CRUD operations

## Local Contracts

- Requires authentication
- Collections scope RAG retrieval to specific document sets
- Uses collection API routes under `/api/collections`

## Work Guidance

- List view shows all collections the user has access to
- Detail view allows adding/removing documents from a collection
- Collections are used as `collectionId` parameter in chat API for scoped retrieval
