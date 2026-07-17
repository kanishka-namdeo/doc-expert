import type { OAuthTokens } from '../types';

const TENANT = 'common';
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const REDIRECT_PATH = '/api/connectors/microsoft-365/callback';
const SCOPES = ['Files.Read.All', 'Sites.Read.All'];

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
    redirect_uri: `${getBaseUrl()}${REDIRECT_PATH}`,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    response_mode: 'query',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(
  code: string,
  _state: string,
): Promise<OAuthTokens> {
  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${getBaseUrl()}${REDIRECT_PATH}`,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    idToken: data.id_token,
  };
}

export async function refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
  if (!tokens.refreshToken) {
    throw new Error('No refresh token available');
  }

  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  return {
    ...tokens,
    accessToken: data.access_token,
    accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? tokens.scope,
  };
}

export function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.accessTokenExpiresAt) return false;
  return tokens.accessTokenExpiresAt < Date.now() + 5 * 60 * 1000;
}
