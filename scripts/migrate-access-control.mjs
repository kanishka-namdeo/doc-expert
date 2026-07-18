#!/usr/bin/env node
/**
 * Access control migration script.
 *
 * Adds document_permission, group, and group_member tables
 * for document-level access control.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'db.sqlite');

const db = new Database(dbPath);

function run(sql) {
  try {
    db.exec(sql);
    console.log(`  OK: ${sql.slice(0, 80)}`);
  } catch (err) {
    console.log(`  SKIP: ${sql.slice(0, 80)} — ${err.message}`);
  }
}

console.log('=== Access Control Migration ===\n');

// Step 1: Create document_permission table
console.log('1. Creating document_permission table...');
run(`
  CREATE TABLE IF NOT EXISTS document_permission (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    userId TEXT,
    groupId TEXT,
    permission TEXT NOT NULL,
    grantedBy TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE(documentId, userId),
    UNIQUE(documentId, groupId)
  )
`);

// Step 2: Create group table
console.log('\n2. Creating group table...');
run(`
  CREATE TABLE IF NOT EXISTS "group" (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL REFERENCES organization(id),
    name TEXT NOT NULL,
    description TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`);

// Step 3: Create group_member table
console.log('\n3. Creating group_member table...');
run(`
  CREATE TABLE IF NOT EXISTS group_member (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL REFERENCES "group"(id),
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE(groupId, userId)
  )
`);

// Step 4: Verify tables exist
console.log('\n4. Verifying tables...');
const tables = ['document_permission', 'group', 'group_member'];
for (const table of tables) {
  try {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    if (tableExists) {
      const [row] = db.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).all();
      console.log(`  OK: ${table} — ${row.cnt} rows`);
    } else {
      console.log(`  MISSING: ${table}`);
    }
  } catch (err) {
    console.log(`  ERROR: ${table} — ${err.message}`);
  }
}

// Step 5: Verify unique constraints
console.log('\n5. Verifying unique constraints...');
try {
  const indexList = db.prepare(`PRAGMA index_list(document_permission)`).all();
  for (const idx of indexList) {
    console.log(`  Index: ${idx.name} (unique: ${idx.unique})`);
  }
} catch (err) {
  console.log(`  Note: ${err.message}`);
}

db.close();

console.log('\n=== Migration Complete ===');
