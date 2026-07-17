import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user, conversation, message } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import DataLoader from 'dataloader';

type UserType = typeof user.$inferSelect;
type ConversationType = typeof conversation.$inferSelect;
type MessageType = typeof message.$inferSelect;

export interface GraphQLContext {
  userId: string | null;
  orgId: string | null;
  db: typeof db;
  loaders: {
    userById: DataLoader<string, UserType | null>;
    conversationById: DataLoader<string, ConversationType | null>;
    messagesByConversationId: DataLoader<string, MessageType[]>;
  };
}

export async function createContext(req: Request): Promise<GraphQLContext> {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id || null;
  let orgId: string | null = null;
  if (userId) {
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { orgId: true },
    });
    orgId = userRecord?.orgId ?? null;
  }

  const loaders = {
    userById: new DataLoader(async (ids: readonly string[]) => {
      const users = await db.select().from(user).where(inArray(user.id, ids as string[]));
      return ids.map((id) => users.find((u) => u.id === id) || null);
    }),
    conversationById: new DataLoader(async (ids: readonly string[]) => {
      const convs = await db.select().from(conversation).where(inArray(conversation.id, ids as string[]));
      return ids.map((id) => convs.find((c) => c.id === id) || null);
    }),
    messagesByConversationId: new DataLoader(async (ids: readonly string[]) => {
      const msgs = await db.select().from(message).where(inArray(message.conversationId, ids as string[]));
      return ids.map((id) => msgs.filter((m) => m.conversationId === id));
    }),
  };

  return { userId, orgId, db, loaders };
}
