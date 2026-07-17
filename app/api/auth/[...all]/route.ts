import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/auth');

export async function GET(request: NextRequest) {
  try {
    return auth.handler(request);
  } catch (error) {
    logger.error({ err: error, method: 'GET', path: request.url }, 'Auth handler failed');
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    return auth.handler(request);
  } catch (error) {
    logger.error({ err: error, method: 'POST', path: request.url }, 'Auth handler failed');
    throw error;
  }
}
