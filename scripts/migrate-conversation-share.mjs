#!/usr/bin/env node
/**
 * Conversation share migration script.
 *
 * Adds groupId column to conversation_share for group-level sharing
 * and makes userId nullable (either userId or groupId is set).
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'db.sqlite');

const db = new Database(dbPath);

console.log('=== Conversation Share Migration ===\n');

// SQLite doesn't support adding columns with ALTER TABLE for complex changes.
// We need to recreate the table.

try {
  // Check if migration already applied
  const tableInfo = db.prepare("PRAGMA table_info(conversation_share)").all();
  const hasGroupId = tableInfo.some(col => col.name === 'groupId');
  const userIdNullable = tableInfo.find(col => col.name === 'userId');

  if (hasGroupId) {
    console.log('Migration already applied — conversation_share has groupId column');
  } else {
    console.log('Migrating conversation_share table...');

    // Step 1: Rename existing table
    db.exec('ALTER TABLE conversation_share RENAME TO conversation_share_old');

    // Step 2: Create new table with groupId column
    db.exec(`
      CREATE TABLE conversation_share (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        userId TEXT,
        groupId TEXT,
        sharedByUserId TEXT NOT NULL,
        permission TEXT DEFAULT 'read',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(conversationId, userId),
        UNIQUE(conversationId, groupId)
      )
    `);

    // Step 3: Copy data from old table
    db.exec(`
      INSERT INTO conversation_share (id, conversationId, userId, sharedByUserId, permission, createdAt, updatedAt)
      SELECT id, conversationId, userId, sharedByUserId, permission, createdAt, updatedAt
      FROM conversation_share_old
    `);

    // Step 4: Drop old table
    db.exec('DROP TABLE conversation_share_old');

    console.log('  OK: conversation_share migrated with groupId column');
  }

  // Verify
  const tables = ['conversation_share'];
  for (const table of tables) {
    const [row] = db.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).all();
    console.log(`  OK: ${table} — ${row.cnt} rows`);
  }
} catch (err) {
  console.log(`  ERROR: ${err.message}`);
}

db.close();

console.log('\n=== Migration Complete ===');
