import Database from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { hashPassword } from 'better-auth/crypto';

const dbPath = 'data/db.sqlite';

// Ensure data directory exists
if (!existsSync('data')) {
  mkdirSync('data', { recursive: true });
}

const sqlite = new Database(dbPath);

// Create tables if they don't exist
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
    orgId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (orgId) REFERENCES organization(id)
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expiresAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    orgId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id),
    FOREIGN KEY (orgId) REFERENCES organization(id)
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
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id)
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
    orgId TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (userId) REFERENCES user(id),
    FOREIGN KEY (orgId) REFERENCES organization(id)
  );

  CREATE TABLE IF NOT EXISTS conversation (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    orgId TEXT,
    title TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id),
    FOREIGN KEY (orgId) REFERENCES organization(id)
  );

  CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    orgId TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (conversationId) REFERENCES conversation(id),
    FOREIGN KEY (orgId) REFERENCES organization(id)
  );
`);

// Test accounts with different roles/contexts
const testAccounts = [
  {
    email: 'admin@docexpert.test',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'admin',
  },
  {
    email: 'editor@docexpert.test',
    password: 'Editor123!',
    name: 'Editor User',
    role: 'editor',
  },
  {
    email: 'viewer@docexpert.test',
    password: 'Viewer123!',
    name: 'Viewer User',
    role: 'viewer',
  },
  {
    email: 'test@docexpert.test',
    password: 'Test123!',
    name: 'Test User',
    role: 'user',
  },
];

async function seed() {
  console.log('Seeding test accounts...\n');
  
  // Get or create default organization
  let existingOrg = sqlite.prepare('SELECT id FROM organization WHERE slug = ?').get('default');
  
  if (!existingOrg) {
    const defaultOrgId = `org_default_${Date.now()}`;
    const now = Date.now();
    sqlite.prepare(
      'INSERT INTO organization (id, name, slug, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
    ).run(defaultOrgId, 'Default Organization', 'default', now, now);
    existingOrg = { id: defaultOrgId };
    console.log('✓ Created default organization');
  } else {
    console.log('✓ Using existing default organization');
  }
  
  const defaultOrgId = existingOrg.id;
  
  // Delete existing credential accounts to ensure fresh password hashes
  sqlite.exec("DELETE FROM account WHERE providerId='credential'");
  sqlite.exec('DELETE FROM user WHERE email IN (\'admin@docexpert.test\', \'editor@docexpert.test\', \'viewer@docexpert.test\', \'test@docexpert.test\')');
  
  const insertUser = sqlite.prepare(
    'INSERT OR IGNORE INTO user (id, email, name, emailVerified, role, orgId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  
  const insertAccount = sqlite.prepare(
    'INSERT OR IGNORE INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  
  const checkUser = sqlite.prepare('SELECT id FROM user WHERE email = ?');
  
  for (const account of testAccounts) {
    const existing = checkUser.get(account.email);
    
    if (existing) {
      // Re-create credential account since we deleted all credential accounts above
      const passwordHash = await hashPassword(account.password);
      const accountId = crypto.randomUUID();
      const now = Date.now();
      insertAccount.run(accountId, existing.id, account.email, 'credential', passwordHash, now, now);
      console.log(`✓ Refreshed credentials for ${account.email} (${account.role})`);
      continue;
    }
    
    const id = crypto.randomUUID();
    const now = Date.now();
    
    insertUser.run(id, account.email, account.name, 1, account.role, defaultOrgId, now, now);
    
    // Hash password with better-auth's hasher
    const passwordHash = await hashPassword(account.password);
    const accountId = crypto.randomUUID();
    
    insertAccount.run(accountId, id, account.email, 'credential', passwordHash, now, now);
    
    console.log(`✓ Created ${account.email} (${account.role})`);
  }
  
  console.log('\n✅ Test accounts seeded successfully!\n');
  console.log('Credentials for testing:');
  console.log('─'.repeat(60));
  testAccounts.forEach(acc => {
    console.log(`  Email:    ${acc.email}`);
    console.log(`  Password: ${acc.password}`);
    console.log(`  Role:     ${acc.role}`);
    console.log('');
  });
  console.log('─'.repeat(60));
  
  sqlite.close();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
