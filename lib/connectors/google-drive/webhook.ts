import type { NextRequest } from 'next/server';
import type { WebhookDelta, WebhookConfig, OAuthTokens } from '../types';
import { randomUUID } from 'node:crypto';

const WATCH_URL = 'https://www.googleapis.com/drive/v3/channels/stop';
const WATCH_CREATE_URL = 'https://www.googleapis.com/drive/v3/files/watch';

export function getWebhookConfig(): WebhookConfig {
  return {
    path: '/api/connectors/webhook/google-drive',
    events: ['change'],
  };
}

/**
 * Google Drive push notifications contain no body — they are a signal
 * that something changed. We return a single "recheck" delta so the
 * sync engine knows to re-list and compare.
 */
export async function handleWebhook(
  request: NextRequest,
  _tokens: OAuthTokens,
): Promise<WebhookDelta[]> {
  // Google Drive webhooks send minimal headers (no body).
  // Validate the resource state header if present.
  const resourceState = request.headers.get('x-goog-resource-state');
  if (resourceState !== 'sync') {
    // Not a sync notification — ignore.
    return [];
  }

  const resourceId = request.headers.get('x-goog-resource-id') ?? '';

  // Return a sentinel delta instructing the sync engine to re-list.
  return [
    {
      kind: 'updated',
      externalId: resourceId,
      resourceUri: request.headers.get('x-goog-resource-uri') ?? undefined,
    },
  ];
}

/**
 * Revoke an existing watch subscription.
 */
export async function stopWebhook(
  tokens: OAuthTokens,
  subscriptionId: string,
): Promise<void> {
  try {
    await fetch(WATCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: subscriptionId }),
    });
  } catch {
    // Best-effort; ignore errors on revoke.
  }
}

/**
 * Create a webhook subscription for Google Drive.
 */
export async function createSubscription(
  tokens: OAuthTokens,
  webhookUrl: string,
): Promise<string> {
  const res = await fetch(WATCH_CREATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: randomUUID(),
      type: 'web_hook',
      address: webhookUrl,
      token: process.env.CONNECTOR_WEBHOOK_SECRET ?? 'default-secret',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive watch failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}
