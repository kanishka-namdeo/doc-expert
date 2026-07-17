import type { OAuthTokens, ConnectorDocument, ListOptions, ListResult } from '../types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
];

export async function listDocuments(
  tokens: OAuthTokens,
  options?: ListOptions,
): Promise<ListResult> {
  // Microsoft Graph doesn't support $filter on file/mimeType for children,
  // so we fetch all items and filter client-side.
  const params = new URLSearchParams({
    $select: 'id,name,file,mimeType,size,createdDateTime,lastModifiedDateTime,webUrl',
    $top: String(options?.pageSize ?? 100),
  });

  if (options?.pageToken) {
    params.set('$skiptoken', options.pageToken);
  }

  const url = `${GRAPH_BASE}/me/drive/root/children?$${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft Graph list failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    value: Array<{
      id: string;
      name: string;
      file?: { mimeType?: string };
      mimeType?: string;
      size?: number;
      createdDateTime: string;
      lastModifiedDateTime: string;
      webUrl: string;
    }>;
    '@odata.nextLink'?: string;
  };

  // Filter to only supported MIME types client-side
  const supported = new Set(SUPPORTED_MIME_TYPES);
  const documents: ConnectorDocument[] = data.value
    .filter((item) => {
      const mt = item.file?.mimeType ?? item.mimeType;
      return mt ? supported.has(mt) : false;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType ?? item.mimeType ?? 'application/octet-stream',
      size: item.size ?? 0,
      createdAt: item.createdDateTime,
      modifiedAt: item.lastModifiedDateTime,
      webUrl: item.webUrl,
    }));

  // Extract next page token from @odata.nextLink if present
  let nextPageToken: string | undefined;
  if (data['@odata.nextLink']) {
    try {
      const nextUrl = new URL(data['@odata.nextLink']);
      nextPageToken = nextUrl.searchParams.get('$skiptoken') ?? undefined;
    } catch {
      // ignore
    }
  }

  return { documents, nextPageToken };
}

export async function fetchDocument(
  tokens: OAuthTokens,
  externalId: string,
  options?: { mimeType?: string; fileName?: string },
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const mimeType = options?.mimeType ?? 'application/octet-stream';

  // First, get the @microsoft.graph.downloadUrl for the file
  const itemUrl = `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(externalId)}`;
  const itemRes = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!itemRes.ok) {
    const text = await itemRes.text();
    throw new Error(`Microsoft Graph item fetch failed: ${itemRes.status} ${text}`);
  }

  const item = (await itemRes.json()) as {
    '@microsoft.graph.downloadUrl'?: string;
    name?: string;
    file?: { mimeType?: string };
    mimeType?: string;
  };

  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) {
    throw new Error('No download URL available for this file');
  }

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(`Download failed: ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const fileName = options?.fileName ?? item.name ?? `${externalId}.bin`;
  const resolvedMimeType = item.file?.mimeType ?? item.mimeType ?? mimeType;

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: resolvedMimeType,
    fileName,
  };
}
