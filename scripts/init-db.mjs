import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
}

const dbPath = path.join(__dirname, '..', 'data', 'db.sqlite');
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  emailVerified INTEGER,
  image TEXT,
  role TEXT DEFAULT 'user',
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
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS conversation (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  fileName TEXT NOT NULL,
  mediaType TEXT,
  fileSize INTEGER,
  status TEXT DEFAULT 'pending',
  reviewedBy TEXT,
  reviewedAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_version (
  id TEXT PRIMARY KEY,
  documentId TEXT NOT NULL,
  version INTEGER NOT NULL,
  fileName TEXT NOT NULL,
  fileSize INTEGER,
  chunkCount INTEGER,
  qdrantTag TEXT,
  uploadedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_share (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  sharedByUserId TEXT NOT NULL,
  permission TEXT DEFAULT 'read',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_document (
  id TEXT PRIMARY KEY,
  collectionId TEXT NOT NULL,
  documentId TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_template (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
`);

console.log('Database initialized successfully');
console.log('Tables created:', sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name).join(', '));

sqlite.close();
