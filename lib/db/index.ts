import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { getLogger } from '@/lib/logger';

const logger = getLogger('db');

let sqlite: Database.Database;
try {
  sqlite = new Database('data/db.sqlite');
} catch (error) {
  logger.error({ err: error, path: 'data/db.sqlite' }, 'Failed to open SQLite database');
  throw error;
}

// Create tables if they don't exist (for better-auth)
try {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    ssoProvider TEXT,
    ssoConfig TEXT,
    maxMembers INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    emailVerified INTEGER,
    image TEXT,
    role TEXT DEFAULT 'user',
    orgId TEXT REFERENCES organization(id),
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expiresAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    orgId TEXT REFERENCES organization(id),
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    idToken TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS conversation (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    title TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collection (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    name TEXT NOT NULL,
    description TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collection_document (
    id TEXT PRIMARY KEY,
    collectionId TEXT NOT NULL,
    documentId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_template (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    category TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connector_account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT REFERENCES organization(id),
    connectorId TEXT NOT NULL,
    accessToken TEXT NOT NULL,
    refreshToken TEXT,
    accessTokenExpiresAt INTEGER,
    scope TEXT,
    lastSyncedAt INTEGER,
    syncStatus TEXT DEFAULT 'idle',
    webhookSubscriptionId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`);
} catch (error) {
  logger.error({ err: error }, 'Failed to initialize database schema');
  sqlite.close();
  throw error;
}

export const db = drizzle(sqlite, { schema });
