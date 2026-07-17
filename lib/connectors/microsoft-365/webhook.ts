import type { NextRequest } from 'next/server';
import type { WebhookDelta, WebhookConfig, OAuthTokens } from '../types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export function getWebhookConfig(): WebhookConfig {
  return {
    path: '/api/connectors/webhook/microsoft-365',
    events: ['updated', 'deleted'],
  };
}

/**
 * Microsoft Graph webhook notifications arrive as JSON with a
 * validationToken query parameter on subscription creation, and as
 * a list of change notifications on subsequent events.
 */
export async function handleWebhook(
  request: NextRequest,
  _tokens: OAuthTokens,
): Promise<WebhookDelta[]> {
  // Validate the validation token (Microsoft sends this on subscription creation)
  const validationToken = request.nextUrl.searchParams.get('validationToken');
  if (validationToken) {
    // Return the token as plain text to complete the handshake.
    // The caller is responsible for writing this to the response.
    throw new ValidationTokenError(validationToken);
  }

  const body = (await request.json()) as {
    value?: Array<{
      subscriptionId: string;
      clientState?: string;
      resource: string;
      changeType: string;
      resourceData?: {
        id?: string;
        '@odata.type'?: string;
      };
    }>;
  };

  if (!body.value) {
    return [];
  }

  const deltas: WebhookDelta[] = body.value.map((notification) => {
    const kind = notification.changeType === 'deleted' ? 'deleted' : 'updated';
    return {
      kind,
      externalId: notification.resourceData?.id ?? extractIdFromResource(notification.resource),
      resourceUri: notification.resource,
    };
  });

  return deltas;
}

function extractIdFromResource(resource: string): string {
  // resource looks like: /me/drive/items/{item-id}
  const parts = resource.split('/');
  return parts[parts.length - 1] ?? resource;
}

export class ValidationTokenError extends Error {
  constructor(public token: string) {
    super('Validation token received');
    this.name = 'ValidationTokenError';
  }
}

/**
 * Create a webhook subscription for a drive item.
 */
export async function createSubscription(
  tokens: OAuthTokens,
  webhookUrl: string,
): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      changeType: 'updated,deleted',
      notificationUrl: webhookUrl,
      resource: 'me/drive/root',
      expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour max for drive
      clientState: process.env.CONNECTOR_WEBHOOK_SECRET ?? 'default-secret',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft subscription failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Delete a webhook subscription.
 */
export async function deleteSubscription(
  tokens: OAuthTokens,
  subscriptionId: string,
): Promise<void> {
  try {
    await fetch(`${GRAPH_BASE}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  } catch {
    // Best-effort; ignore errors on delete.
  }
}
