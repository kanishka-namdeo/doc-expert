import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

// Organization table for multi-tenancy
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ssoProvider: text('ssoProvider'), // 'saml' | 'oidc' | null
  ssoConfig: text('ssoConfig'), // encrypted JSON config
  maxMembers: integer('maxMembers'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// Better Auth tables
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: integer('emailVerified'),
  image: text('image'),
  role: text('role').default('user'), // 'admin' | 'editor' | 'viewer' | 'user'
  orgId: text('orgId').references(() => organization.id),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  orgId: text('orgId').references(() => organization.id),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt'),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt'),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  timestamp: integer('timestamp').notNull(),
  metadata: text('metadata'),
});
// Conversation tables
export const conversation = sqliteTable('conversation', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  title: text('title'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const message = sqliteTable('message', {
  id: text('id').primaryKey(),
  conversationId: text('conversationId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(), // JSON string of message parts
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  metadata: text('metadata'), // JSON string for model, tokens, etc.
});

// Document metadata table (for approval workflow and versioning)
export const document = sqliteTable('document', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  fileName: text('fileName').notNull(),
  mediaType: text('mediaType'),
  fileSize: integer('fileSize'),
  status: text('status').default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewedBy'),
  reviewedAt: integer('reviewedAt', { mode: 'timestamp_ms' }),
  source: text('source').default('upload'), // 'upload' | 'google-drive' | 'microsoft-365'
  externalId: text('externalId'), // remote document ID from connector
  lastRemoteModified: integer('lastRemoteModified', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  uniqueUserSourceExternal: unique().on(table.userId, table.source, table.externalId),
}));

// Connector account table for OAuth-managed external sources
export const connectorAccount = sqliteTable('connector_account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  connectorId: text('connectorId').notNull(), // 'google-drive' | 'microsoft-365'
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  lastSyncedAt: integer('lastSyncedAt', { mode: 'timestamp_ms' }),
  syncStatus: text('syncStatus').default('idle'), // 'idle' | 'syncing' | 'error'
  webhookSubscriptionId: text('webhookSubscriptionId'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// Document version table
export const documentVersion = sqliteTable('document_version', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull(),
  version: integer('version').notNull(),
  fileName: text('fileName').notNull(),
  fileSize: integer('fileSize'),
  chunkCount: integer('chunkCount'),
  qdrantTag: text('qdrantTag'),
  uploadedAt: integer('uploadedAt', { mode: 'timestamp_ms' }).notNull(),
});

// Conversation sharing table
export const conversationShare = sqliteTable('conversation_share', {
  id: text('id').primaryKey(),
  conversationId: text('conversationId').notNull(),
  userId: text('userId').notNull(),
  sharedByUserId: text('sharedByUserId').notNull(),
  permission: text('permission').default('read'), // 'read' | 'write'
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// System configuration table (default model, etc.)
export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// Document collections for scoped Q&A
export const collection = sqliteTable('collection', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// Collection-document join table
export const collectionDocument = sqliteTable('collection_document', {
  id: text('id').primaryKey(),
  collectionId: text('collectionId').notNull(),
  documentId: text('documentId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
});

// Prompt templates for reusable queries
export const promptTemplate = sqliteTable('prompt_template', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  orgId: text('orgId').references(() => organization.id),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  category: text('category'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});
