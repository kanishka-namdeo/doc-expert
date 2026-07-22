export interface HintContext {
  messageCount: number;
  hasCollection: boolean;
  hasDocuments: boolean;
  documentCount: number;
  collectionDocumentCount: number;
  isFirstDocumentView: boolean;
  conversationMessageCount: number;
}

export interface Hint {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  trigger: (ctx: HintContext) => boolean;
  cooldownDays: number;
}

export const HINTS: Hint[] = [
  {
    id: 'suggest-collection',
    title: 'Try a collection',
    description: 'You\'ve asked a few questions without scoping. Create a collection to focus searches on specific documents.',
    actionLabel: 'Create collection',
    actionHref: '/collections',
    trigger: (ctx) => ctx.messageCount >= 6 && !ctx.hasCollection,
    cooldownDays: 7,
  },
  {
    id: 'suggest-share-document',
    title: 'Share this document',
    description: 'You can share documents with teammates so they can view and search them too.',
    actionLabel: 'Share',
    trigger: (ctx) => ctx.isFirstDocumentView,
    cooldownDays: 7,
  },
  {
    id: 'empty-documents',
    title: 'Get started with documents',
    description: 'Upload a document or connect a source like Google Drive to start asking questions.',
    actionLabel: 'Upload document',
    actionHref: '/documents',
    trigger: (ctx) => !ctx.hasDocuments,
    cooldownDays: 7,
  },
  {
    id: 'empty-collection',
    title: 'Add documents to this collection',
    description: 'Collections let you ask scoped questions. Add documents to get started.',
    actionLabel: 'Add documents',
    trigger: (ctx) => ctx.collectionDocumentCount === 0,
    cooldownDays: 7,
  },
  {
    id: 'suggest-export-conversation',
    title: 'Long conversation',
    description: 'This conversation is getting long. You can share it or start a new one to keep things organized.',
    actionLabel: 'Share conversation',
    trigger: (ctx) => ctx.conversationMessageCount >= 10,
    cooldownDays: 7,
  },
];
