import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema';
import {
  loadOrgSsoConfig,
  validateSamlResponse,
  extractUserInfo,
  findOrCreateSsoUser,
} from '@/lib/auth/sso';
import { logAuditEvent } from '@/lib/audit';

const logger = getLogger('api/auth/sso/callback');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/auth/sso/callback
 *
 * Receives the SAML Response from the Identity Provider,
 * validates it, and creates a session for the user.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const samlResponse = formData.get('SAMLResponse') as string | null;
  const relayState = formData.get('RelayState') as string | null;

  if (!samlResponse) {
    logger.warn({}, 'SAML callback received without SAMLResponse');
    return NextResponse.json(
      { error: 'Missing SAML response' },
      { status: 400 }
    );
  }

  // Resolve the organization from RelayState
  let orgSlug: string | null = null;
  if (relayState) {
    try {
      const decoded = JSON.parse(
        Buffer.from(relayState, 'base64').toString('utf8')
      );
      orgSlug = decoded.orgSlug;
    } catch {
      logger.warn({ relayState }, 'Failed to decode RelayState');
    }
  }

  if (!orgSlug) {
    logger.warn({}, 'SAML callback received without org context in RelayState');
    return NextResponse.json(
      { error: 'Missing organization context' },
      { status: 400 }
    );
  }

  const config = await loadOrgSsoConfig(orgSlug);
  if (!config) {
    logger.warn({ orgSlug }, 'SSO config not found during callback');
    return NextResponse.json(
      { error: 'SSO configuration not found' },
      { status: 400 }
    );
  }

  // Validate the SAML response signature
  let profile;
  try {
    profile = await validateSamlResponse(samlResponse, config);
  } catch (error) {
    logger.error(
      { err: error, orgSlug },
      'SAML response validation failed — possible tampered assertion'
    );
    return NextResponse.json(
      { error: 'Invalid SAML response' },
      { status: 401 }
    );
  }

  // Extract user info from the assertion
  let userInfo: { email: string; name: string };
  try {
    userInfo = extractUserInfo(profile);
  } catch (error) {
    logger.error(
      { err: error, orgSlug },
      'Failed to extract user info from SAML assertion'
    );
    return NextResponse.json(
      { error: 'Could not extract user information from SAML response' },
      { status: 400 }
    );
  }

  logger.info(
    { email: userInfo.email, orgSlug },
    'SAML validated, resolving user'
  );

  // Find or create the user in the organization
  const result = await findOrCreateSsoUser(
    userInfo.email,
    userInfo.name,
    orgSlug,
    config
  );

  if (!result) {
    logger.info(
      { email: userInfo.email, orgSlug },
      'SSO login blocked — user not found and auto-provisioning disabled'
    );
    return NextResponse.redirect(
      new URL(`/login?sso-error=provisioning-disabled`, request.url)
    );
  }

  const { userId, isNew } = result;

  // Create a session record in the database
  try {
    const sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await db.insert(sessionTable).values({
      id: crypto.randomUUID(),
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: request.headers.get('x-forwarded-for') || null,
      userAgent: request.headers.get('user-agent') || null,
      createdAt: new Date(Date.now()),
      updatedAt: new Date(Date.now()),
    });

    // Set the session cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('better-auth.session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    logger.info(
      { userId, email: userInfo.email, orgSlug, isNew },
      'SSO login successful'
    );

    await logAuditEvent(
      userId,
      isNew ? 'sso_auto_provisioned' : 'sso_login',
      'auth',
      { email: userInfo.email, orgSlug, provider: 'saml' }
    );

    return response;
  } catch (error) {
    logger.error({ err: error, userId, email: userInfo.email }, 'Failed to create SSO session');
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
