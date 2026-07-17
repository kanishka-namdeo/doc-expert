import { createYoga } from 'graphql-yoga';
import { schema } from '@/lib/graphql/schema';
import { createContext } from '@/lib/graphql/context';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/graphql');

const yoga = createYoga({
  schema,
  context: async ({ request }) => createContext(request),
  logging: logger,
  graphiql: process.env.NODE_ENV === 'development',
});

export const GET = yoga;
export const POST = yoga;
