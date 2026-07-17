import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';

const db = new Database('data/db.sqlite');

const email = 'test@example.com';
const password = 'Test123!';
const name = 'Test User';

async function createUser() {
  const hashedPassword = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email, name, 1, now, now);

  db.prepare(`
    INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), id, email, 'credential', hashedPassword, now, now);

  console.log(`User created: ${email} / ${password}`);
  db.close();
}

createUser().catch(console.error);
