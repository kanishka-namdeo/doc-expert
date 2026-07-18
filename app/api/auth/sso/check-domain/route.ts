import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { findOrgByDomain } from '@/lib/auth/sso';

const logger = getLogger('api/auth/sso/check-domain');

/**
 * POST /api/auth/sso/check-domain
 *
 * Checks whether an email domain has SSO configured.
 * Returns the org slug if SSO is enabled for that domain.
 */
export async function POST(request: NextRequest) {
  let body: { domain: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { domain } = body;
  if (!domain || typeof domain !== 'string') {
    return NextResponse.json(
      { error: 'Domain is required' },
      { status: 400 }
    );
  }

  try {
    const orgSlug = await findOrgByDomain(domain.toLowerCase());

    if (orgSlug) {
      logger.info({ domain, orgSlug }, 'SSO found for domain');
      return NextResponse.json({ ssoEnabled: true, orgSlug });
    }

    logger.info({ domain }, 'No SSO configured for domain');
    return NextResponse.json({ ssoEnabled: false });
  } catch (error) {
    logger.error({ err: error, domain }, 'Error checking domain SSO');
    return NextResponse.json(
      { error: 'Failed to check domain' },
      { status: 500 }
    );
  }
}
