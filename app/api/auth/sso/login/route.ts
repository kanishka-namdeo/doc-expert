import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { loadOrgSsoConfig, generateSamlRequest } from '@/lib/auth/sso';

const logger = getLogger('api/auth/sso/login');

/**
 * GET /api/auth/sso/login?org={slug}
 *
 * Initiates a SAML SSO flow by generating an AuthnRequest and
 * redirecting the user to their Identity Provider's SSO URL.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orgSlug = searchParams.get('org');

  if (!orgSlug) {
    return NextResponse.json(
      { error: 'Organization slug is required' },
      { status: 400 }
    );
  }

  try {
    const config = await loadOrgSsoConfig(orgSlug);

    if (!config) {
      logger.warn({ orgSlug }, 'SSO not configured for organization');
      return NextResponse.json(
        { error: 'SSO is not configured for this organization' },
        { status: 404 }
      );
    }

    const redirectUrl = await generateSamlRequest(orgSlug, config);

    logger.info(
      { orgSlug, entryPoint: config.entryPoint },
      'SAML AuthnRequest generated'
    );

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error({ err: error, orgSlug }, 'Failed to generate SAML request');
    return NextResponse.json(
      { error: 'Failed to initiate SSO login' },
      { status: 500 }
    );
  }
}
