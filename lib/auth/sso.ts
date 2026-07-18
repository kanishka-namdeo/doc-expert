import crypto from 'crypto';
import { SAML, Profile } from '@node-saml/node-saml';
import { db } from '@/lib/db';
import { organization, user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';
import { auth } from './index';

const logger = getLogger('auth/sso');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * SSO configuration stored per-organization.
 * The sensitive fields (entryPoint, idpCert, issuer) are encrypted at rest.
 */
export interface SsoConfig {
  entryPoint: string;
  idpCert: string;
  issuer: string;
  callbackUrl: string;
  autoProvisioning: boolean;
  defaultRole: string;
}

interface EncryptedSsoConfig {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts an SSO config using AES-256-GCM.
 * Returns the encrypted data, IV, and auth tag as hex strings.
 */
export function encryptSsoConfig(config: SsoConfig, secret: string): EncryptedSsoConfig {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secret, 'hex'), iv);

  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return { encrypted, iv: iv.toString('hex'), authTag };
}

/**
 * Decrypts an SSO config that was encrypted with encryptSsoConfig.
 */
export function decryptSsoConfig(encrypted: EncryptedSsoConfig, secret: string): SsoConfig {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(secret, 'hex'),
    Buffer.from(encrypted.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted) as SsoConfig;
}

/**
 * Loads and decrypts the SSO config for an organization by slug.
 */
export async function loadOrgSsoConfig(orgSlug: string): Promise<SsoConfig | null> {
  const secret = process.env.SSO_ENCRYPTION_KEY;
  if (!secret) {
    logger.warn({}, 'SSO_ENCRYPTION_KEY not configured');
    return null;
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.slug, orgSlug),
    columns: { ssoConfig: true },
  });

  if (!org?.ssoConfig) return null;

  try {
    const parsed = JSON.parse(org.ssoConfig) as EncryptedSsoConfig;
    return decryptSsoConfig(parsed, secret);
  } catch (error) {
    logger.error({ err: error, orgSlug }, 'Failed to decrypt SSO config');
    return null;
  }
}

/**
 * Loads and decrypts the SSO config for an organization by ID.
 */
export async function loadOrgSsoConfigById(orgId: string): Promise<SsoConfig | null> {
  const secret = process.env.SSO_ENCRYPTION_KEY;
  if (!secret) {
    logger.warn({}, 'SSO_ENCRYPTION_KEY not configured');
    return null;
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
    columns: { ssoConfig: true },
  });

  if (!org?.ssoConfig) return null;

  try {
    const parsed = JSON.parse(org.ssoConfig) as EncryptedSsoConfig;
    return decryptSsoConfig(parsed, secret);
  } catch (error) {
    logger.error({ err: error, orgId }, 'Failed to decrypt SSO config');
    return null;
  }
}

/**
 * Generates a SAML AuthnRequest for the given organization.
 * Returns the redirect URL to the IdP.
 */
export async function generateSamlRequest(
  orgSlug: string,
  config: SsoConfig
): Promise<string> {
  const saml = new SAML({
    entryPoint: config.entryPoint,
    issuer: config.issuer,
    callbackUrl: config.callbackUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    idpCert: config.idpCert,
    acceptedClockSkewMs: 30000,
    wantAssertionsSigned: true,
  });

  const relayState = Buffer.from(
    JSON.stringify({ orgSlug, timestamp: Date.now() })
  ).toString('base64');

  const url = await saml.getAuthorizeUrlAsync(relayState, config.callbackUrl, {
    samlFallback: 'login-request',
  });

  return url;
}

/**
 * Validates a SAML response and returns the user profile.
 * Throws if the signature is invalid or the assertion is malformed.
 */
export async function validateSamlResponse(
  responseXml: string,
  config: SsoConfig
): Promise<Profile> {
  const saml = new SAML({
    entryPoint: config.entryPoint,
    issuer: config.issuer,
    callbackUrl: config.callbackUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    idpCert: config.idpCert,
    acceptedClockSkewMs: 30000,
    wantAssertionsSigned: true,
  });

  const result = await saml.validatePostResponseAsync({ SAMLResponse: responseXml });

  if (!result.profile) {
    throw new Error('SAML response validation failed: no profile extracted');
  }

  return result.profile;
}

/**
 * Extracts user info (email, name) from a SAML profile.
 */
export function extractUserInfo(profile: Profile): { email: string; name: string } {
  const email = profile.mail || profile.email || profile.nameID;
  if (!email) {
    throw new Error('No email found in SAML assertion');
  }

  // Some IdPs provide displayName, givenName, sn (surname)
  const profileRecord = profile as Record<string, unknown>;
  const givenName =
    typeof profileRecord['givenName'] === 'string'
      ? profileRecord['givenName']
      : undefined;
  const surname =
    typeof profileRecord['sn'] === 'string'
      ? profileRecord['sn']
      : undefined;
  const displayName =
    typeof profileRecord['displayName'] === 'string'
      ? profileRecord['displayName']
      : undefined;

  let name =
    (typeof profile.name === 'string' ? profile.name : '') ||
    (typeof displayName === 'string' ? displayName : '') ||
    '';
  if (!name && typeof givenName === 'string' && typeof surname === 'string') {
    name = `${givenName} ${surname}`;
  }
  if (!name) {
    name = email.split('@')[0];
  }

  return { email: email.toLowerCase().trim(), name };
}

/**
 * Finds or creates a user in the organization based on SSO profile.
 * If autoProvisioning is false and the user doesn't exist, returns null.
 */
export async function findOrCreateSsoUser(
  email: string,
  name: string,
  orgSlug: string,
  config: SsoConfig
): Promise<{ userId: string; isNew: boolean } | null> {
  const org = await db.query.organization.findFirst({
    where: eq(organization.slug, orgSlug),
    columns: { id: true, name: true },
  });

  if (!org) {
    logger.warn({ orgSlug }, 'Organization not found for SSO login');
    return null;
  }

  // Check if user already exists (matched by email)
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
    columns: { id: true, orgId: true },
  });

  if (existingUser) {
    // User exists — verify they belong to this org
    if (existingUser.orgId !== org.id) {
      logger.warn(
        { email, existingOrgId: existingUser.orgId, targetOrgId: org.id },
        'SSO user belongs to a different organization'
      );
      return null;
    }
    return { userId: existingUser.id, isNew: false };
  }

  // User doesn't exist — check auto-provisioning
  if (!config.autoProvisioning) {
    logger.info(
      { email, orgSlug },
      'SSO user not found and auto-provisioning is disabled'
    );
    return null;
  }

  // Create the user
  const userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    email: email.toLowerCase(),
    name,
    role: config.defaultRole || 'user',
    orgId: org.id,
    emailVerified: Date.now(),
    createdAt: new Date(Date.now()),
    updatedAt: new Date(Date.now()),
  });

  logger.info(
    { userId, email, orgId: org.id, role: config.defaultRole },
    'SSO user auto-provisioned'
  );

  return { userId, isNew: true };
}

/**
 * Looks up an organization by email domain.
 * Returns the org slug if a matching SSO-enabled org is found.
 */
export async function findOrgByDomain(domain: string): Promise<string | null> {
  // For now, we match by checking all orgs with SSO config
  // In production, you'd store a domain mapping table
  const orgs = await db.query.organization.findMany({
    columns: { id: true, slug: true, ssoConfig: true },
    where: undefined,
  });

  const secret = process.env.SSO_ENCRYPTION_KEY;
  if (!secret) return null;

  for (const org of orgs) {
    if (!org.ssoConfig) continue;
    try {
      const parsed = JSON.parse(org.ssoConfig) as EncryptedSsoConfig;
      const config = decryptSsoConfig(parsed, secret);
      // Match domain from issuer or a configured domain
      // For simplicity, we check if the issuer contains the domain
      if (config.issuer.toLowerCase().includes(domain.toLowerCase())) {
        return org.slug;
      }
    } catch {
      continue;
    }
  }

  return null;
}
