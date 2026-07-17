import type { OAuthTokens, ConnectorDocument, ListOptions, ListResult } from '../types';

const DRIVE_LIST_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_DOWNLOAD_URL = 'https://www.googleapis.com/drive/v3/files';

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
];

// Google Workspace MIME types that need export
const GOOGLE_WORKSPACE_MIME_MAP: Record<string, string> = {
  'application/vnd.google-apps.document': 'application/pdf',
  'application/vnd.google-apps.spreadsheet': 'application/pdf',
  'application/vnd.google-apps.presentation': 'application/pdf',
};

const DRIVE_QUERY = SUPPORTED_MIME_TYPES.map((t) => `mimeType='${t}'`).concat(
  Object.keys(GOOGLE_WORKSPACE_MIME_MAP).map((t) => `mimeType='${t}'`),
).join(' or ');

export async function listDocuments(
  tokens: OAuthTokens,
  options?: ListOptions,
): Promise<ListResult> {
  const params = new URLSearchParams({
    q: DRIVE_QUERY,
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webLink),nextPageToken',
    pageSize: String(options?.pageSize ?? 100),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  if (options?.pageToken) {
    params.set('pageToken', options.pageToken);
  }

  const res = await fetch(`${DRIVE_LIST_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive list failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    files: Array<{
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      createdTime: string;
      modifiedTime: string;
      webLink: string;
    }>;
    nextPageToken?: string;
  };

  const documents: ConnectorDocument[] = data.files.map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? parseInt(file.size, 10) : 0,
    createdAt: file.createdTime,
    modifiedAt: file.modifiedTime,
    webUrl: file.webLink,
  }));

  return { documents, nextPageToken: data.nextPageToken };
}

export async function fetchDocument(
  tokens: OAuthTokens,
  externalId: string,
  options?: { mimeType?: string; fileName?: string },
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const mimeType = options?.mimeType ?? 'application/pdf';
  const suggestedFileName = options?.fileName;
  // Determine the actual download MIME type (handle Google Workspace exports)
  const exportMimeType = GOOGLE_WORKSPACE_MIME_MAP[mimeType];
  const downloadMimeType = exportMimeType ?? mimeType;

  const params = new URLSearchParams({ alt: 'media' });
  if (exportMimeType) {
    params.set('exportMimeType', 'pdf');
  }

  const url = `${DRIVE_DOWNLOAD_URL}/${encodeURIComponent(externalId)}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive download failed: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const fileName = suggestedFileName ?? `${externalId}.${getFileExtension(downloadMimeType)}`;

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: downloadMimeType,
    fileName,
  };
}

function getFileExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'text/markdown':
      return 'md';
    default:
      return 'bin';
  }
}
