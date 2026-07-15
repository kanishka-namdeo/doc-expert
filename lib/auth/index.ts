import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sqliteTable, sqliteText } from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';

const sqlite = new Database('data/db.sqlite');

export const auth = betterAuth({
  database: drizzleAdapter(sqlite, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
