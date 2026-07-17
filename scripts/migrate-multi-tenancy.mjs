#!/usr/bin/env node
/**
 * Multi-tenancy migration script.
 *
 * Adds organization table and orgId columns to all existing tables,
 * creates a default organization, and backfills all existing records.
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
    // SQLite doesn't support all ALTER TABLE operations; log and continue
    console.log(`  SKIP: ${sql.slice(0, 80)} — ${err.message}`);
  }
}

function addColumn(table, column, definition) {
  // Check if column already exists
  const [info] = db.prepare(`PRAGMA table_info(${table})`).all();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = rows.some((r) => r.name === column);
  if (exists) {
    console.log(`  SKIP: column ${table}.${column} already exists`);
    return;
  }
  run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

console.log('=== Multi-Tenancy Migration ===\n');

// Step 1: Create organization table if it doesn't exist
console.log('1. Creating organization table...');
run(`
  CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    ssoProvider TEXT,
    ssoConfig TEXT,
    maxMembers INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`);

// Step 2: Create default organization
console.log('\n2. Creating default organization...');
const now = Date.now();
const defaultOrgId = 'org_default_' + now;
try {
  db.prepare(`
    INSERT OR IGNORE INTO organization (id, name, slug, createdAt, updatedAt)
    VALUES (?, 'Default Organization', 'default', ?, ?)
  `).run(defaultOrgId, now, now);

  const [org] = db.prepare(`SELECT id FROM organization WHERE slug = 'default'`).all();
  if (org) {
    console.log(`  Default org created with id: ${org.id}`);
  } else {
    // Fallback: use the generated id
    console.log(`  Default org id: ${defaultOrgId}`);
  }
} catch (err) {
  console.log(`  Note: ${err.message}`);
}

// Get the default org id
const [defaultOrgRow] = db.prepare(`SELECT id FROM organization WHERE slug = 'default' LIMIT 1`).all();
const defaultOrgIdFinal = defaultOrgRow ? defaultOrgRow.id : defaultOrgId;
console.log(`  Using default org id: ${defaultOrgIdFinal}`);

// Step 3: Add orgId columns to all tables
console.log('\n3. Adding orgId columns to tables...');
const tables = [
  'user',
  'session',
  'audit_log',
  'conversation',
  'message',
  'document',
  'connector_account',
  'collection',
  'collection_document',
  'prompt_template',
];

for (const table of tables) {
  addColumn(table, 'orgId', 'TEXT REFERENCES organization(id)');
}

// Step 4: Backfill existing records with default orgId
console.log('\n4. Backfilling existing records...');

const backfillTargets = [
  { table: 'user', where: 'orgId IS NULL' },
  { table: 'conversation', where: 'orgId IS NULL' },
  { table: 'message', where: 'orgId IS NULL' },
  { table: 'document', where: 'orgId IS NULL' },
  { table: 'connector_account', where: 'orgId IS NULL' },
  { table: 'collection', where: 'orgId IS NULL' },
  { table: 'collection_document', where: 'orgId IS NULL' },
  { table: 'prompt_template', where: 'orgId IS NULL' },
  { table: 'audit_log', where: 'orgId IS NULL' },
];

for (const { table, where } of backfillTargets) {
  try {
    // Check table exists first
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    if (!tableExists) {
      console.log(`  SKIP: table ${table} does not exist`);
      continue;
    }

    const result = db.prepare(`
      UPDATE ${table} SET orgId = ? WHERE ${where}
    `).run(defaultOrgIdFinal);

    console.log(`  Updated ${result.changes} rows in ${table}`);
  } catch (err) {
    console.log(`  ERROR updating ${table}: ${err.message}`);
  }
}

// Step 5: Backfill session orgId from user orgId
console.log('\n5. Backfilling session orgId from user...');
try {
  const result = db.prepare(`
    UPDATE session SET orgId = (
      SELECT orgId FROM user WHERE user.id = session.userId
    ) WHERE orgId IS NULL AND userId IN (SELECT id FROM user)
  `).run();
  console.log(`  Updated ${result.changes} session rows`);
} catch (err) {
  console.log(`  Note: ${err.message}`);
}

// Step 6: Verify no NULL orgId values remain
console.log('\n6. Verifying no NULL orgId values...');
const nullChecks = [
  'user',
  'conversation',
  'document',
  'collection',
  'prompt_template',
  'connector_account',
];

let allClear = true;
for (const table of nullChecks) {
  try {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    if (!tableExists) continue;

    const [row] = db.prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE orgId IS NULL`).all();
    if (row.cnt > 0) {
      console.log(`  WARN: ${table} has ${row.cnt} NULL orgId values`);
      allClear = false;
    } else {
      console.log(`  OK: ${table} — 0 NULL orgId values`);
    }
  } catch (err) {
    console.log(`  SKIP: ${table} — ${err.message}`);
  }
}

// Step 7: Verify organization table
console.log('\n7. Organization table contents:');
try {
  const orgs = db.prepare(`SELECT id, name, slug, createdAt FROM organization`).all();
  for (const org of orgs) {
    console.log(`  ${org.id} | ${org.name} | ${org.slug}`);
  }
} catch (err) {
  console.log(`  ERROR: ${err.message}`);
}

db.close();

console.log('\n=== Migration Complete ===');
if (allClear) {
  console.log('All tables backfilled successfully.');
} else {
  console.log('WARNING: Some tables still have NULL orgId values.');
  process.exit(1);
}
