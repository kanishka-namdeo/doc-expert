import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { sendPasswordResetEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';

async function getDefaultOrgId(): Promise<string | null> {
  const org = await db.query.organization.findFirst({
    where: eq(schema.organization.slug, 'default'),
  });
  return org?.id ?? null;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        returned: true,
        defaultValue: 'user',
      },
      orgId: {
        type: 'string',
        required: false,
        returned: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const orgId = await getDefaultOrgId();
          return {
            data: {
              ...user,
              role: (user.role as string) ?? 'user',
              orgId: (user.orgId as string) ?? orgId,
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
