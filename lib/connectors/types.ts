import type { NextRequest } from 'next/server';

export interface ConnectorDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  webUrl?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  scope?: string;
  idToken?: string;
}

export interface ListOptions {
  pageToken?: string;
  pageSize?: number;
  query?: string;
  folderId?: string;
}

export interface ListResult {
  documents: ConnectorDocument[];
  nextPageToken?: string;
}

export interface WebhookDelta {
  kind: 'created' | 'updated' | 'deleted';
  externalId: string;
  resourceUri?: string;
}

export interface SyncStats {
  found: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  skipped: number;
}

export interface SyncJob {
  id: string;
  connectorId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  stats: SyncStats;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface IngestProgress {
  step: string;
  progress: number;
  message: string;
}

export interface WebhookConfig {
  path: string;
  events: string[];
}

export interface Connector {
  id: string;
  name: string;
  icon: string;

  getAuthUrl(state: string): string;
  handleCallback(code: string, state: string): Promise<OAuthTokens>;
  refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
  isTokenExpired(tokens: OAuthTokens): boolean;

  listDocuments(
    tokens: OAuthTokens,
    options?: ListOptions,
  ): Promise<ListResult>;
  fetchDocument(
    tokens: OAuthTokens,
    externalId: string,
    options?: { mimeType?: string; fileName?: string },
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>;

  getWebhookConfig(): WebhookConfig;
  handleWebhook(request: NextRequest, tokens: OAuthTokens): Promise<WebhookDelta[]>;
}

const registry = new Map<string, Connector>();

export function registerConnector(connector: Connector): void {
  registry.set(connector.id, connector);
}

export function getConnector(id: string): Connector | undefined {
  return registry.get(id);
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values());
}
