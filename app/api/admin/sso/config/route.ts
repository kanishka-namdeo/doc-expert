import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/logger';
import { requireAdmin, getOrgId } from '@/lib/auth/rbac';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organization } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  encryptSsoConfig,
  decryptSsoConfig,
  SsoConfig,
} from '@/lib/auth/sso';
import { logAuditEvent } from '@/lib/audit';

const logger = getLogger('api/admin/sso/config');

const callbackUrl =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface SsoConfigInput {
  entryPoint: string;
  idpCert: string;
  issuer: string;
  autoProvisioning: boolean;
  defaultRole: string;
}

/**
 * GET /api/admin/sso/config
 * Returns the current (decrypted) SSO config for the admin's organization.
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status }
    );
  }

  const orgId = getOrgId(request);
  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not configured' },
      { status: 403 }
    );
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
    columns: { id: true, name: true, slug: true, ssoProvider: true, ssoConfig: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 }
    );
  }

  let config: SsoConfig | null = null;
  if (org.ssoConfig) {
    const secret = process.env.SSO_ENCRYPTION_KEY;
    if (secret) {
      try {
        const parsed = JSON.parse(org.ssoConfig) as {
          encrypted: string;
          iv: string;
          authTag: string;
        };
        config = decryptSsoConfig(parsed, secret);
      } catch {
        logger.warn({ orgId }, 'Could not decrypt SSO config');
      }
    }
  }

  return NextResponse.json({
    ssoEnabled: !!config,
    ssoProvider: org.ssoProvider,
    config: config
      ? {
          entryPoint: config.entryPoint,
          issuer: config.issuer,
          autoProvisioning: config.autoProvisioning,
          defaultRole: config.defaultRole,
        }
      : null,
  });
}

/**
 * PUT /api/admin/sso/config
 * Validates and saves SSO config (encrypted) for the admin's organization.
 */
export async function PUT(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status }
    );
  }

  const orgId = getOrgId(request);
  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not configured' },
      { status: 403 }
    );
  }

  let body: SsoConfigInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { entryPoint, idpCert, issuer, autoProvisioning, defaultRole } = body;

  // Validate required fields
  if (!entryPoint || !idpCert || !issuer) {
    return NextResponse.json(
      { error: 'entryPoint, idpCert, and issuer are required' },
      { status: 400 }
    );
  }

  // Basic validation of certificate format
  if (!idpCert.includes('-----BEGIN') || !idpCert.includes('-----END')) {
    return NextResponse.json(
      { error: 'idpCert must be a valid PEM-encoded certificate' },
      { status: 400 }
    );
  }

  const secret = process.env.SSO_ENCRYPTION_KEY;
  if (!secret) {
    logger.error(
      {},
      'SSO_ENCRYPTION_KEY not configured — cannot save SSO config'
    );
    return NextResponse.json(
      { error: 'SSO encryption key not configured on server' },
      { status: 500 }
    );
  }

  const ssoConfig: SsoConfig = {
    entryPoint,
    idpCert,
    issuer,
    callbackUrl,
    autoProvisioning: autoProvisioning !== false,
    defaultRole: defaultRole || 'user',
  };

  const encrypted = encryptSsoConfig(ssoConfig, secret);

  try {
    await db
      .update(organization)
      .set({
        ssoProvider: 'saml',
        ssoConfig: JSON.stringify(encrypted),
        updatedAt: new Date(Date.now()),
      })
      .where(eq(organization.id, orgId));

    logger.info(
      { orgId, entryPoint, autoProvisioning: ssoConfig.autoProvisioning },
      'SSO config saved'
    );

    await logAuditEvent(
      adminResult.user.id,
      'sso_config_updated',
      'sso',
      { orgId, entryPoint }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, orgId }, 'Failed to save SSO config');
    return NextResponse.json(
      { error: 'Failed to save SSO configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sso/config
 * Removes SSO configuration for the admin's organization.
 */
export async function DELETE(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status }
    );
  }

  const orgId = getOrgId(request);
  if (!orgId) {
    return NextResponse.json(
      { error: 'Organization not configured' },
      { status: 403 }
    );
  }

  try {
    await db
      .update(organization)
      .set({
        ssoProvider: null,
        ssoConfig: null,
        updatedAt: new Date(Date.now()),
      })
      .where(eq(organization.id, orgId));

    logger.info({ orgId }, 'SSO config removed');

    await logAuditEvent(
      adminResult.user.id,
      'sso_config_removed',
      'sso',
      { orgId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, orgId }, 'Failed to remove SSO config');
    return NextResponse.json(
      { error: 'Failed to remove SSO configuration' },
      { status: 500 }
    );
  }
}
