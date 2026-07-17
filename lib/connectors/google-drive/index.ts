import type { Connector, OAuthTokens, ListOptions, ListResult, WebhookConfig, WebhookDelta } from '../types';
import type { NextRequest } from 'next/server';
import * as oauth from './oauth';
import * as docs from './documents';
import * as webhook from './webhook';

export const googleDriveConnector: Connector = {
  id: 'google-drive',
  name: 'Google Drive',
  icon: 'google-drive',

  getAuthUrl(state: string): string {
    return oauth.getAuthUrl(state);
  },

  async handleCallback(code: string, state: string): Promise<OAuthTokens> {
    return oauth.handleCallback(code, state);
  },

  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    return oauth.refreshToken(tokens);
  },

  isTokenExpired(tokens: OAuthTokens): boolean {
    return oauth.isTokenExpired(tokens);
  },

  async listDocuments(
    tokens: OAuthTokens,
    options?: ListOptions,
  ): Promise<ListResult> {
    return docs.listDocuments(tokens, options);
  },

  async fetchDocument(
    tokens: OAuthTokens,
    externalId: string,
    options?: { mimeType?: string; fileName?: string },
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    return docs.fetchDocument(tokens, externalId, options);
  },

  getWebhookConfig(): WebhookConfig {
    return webhook.getWebhookConfig();
  },

  async handleWebhook(
    request: NextRequest,
    tokens: OAuthTokens,
  ): Promise<WebhookDelta[]> {
    return webhook.handleWebhook(request, tokens);
  },
};
