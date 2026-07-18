'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Cloud,
  FolderSync,
} from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface ConnectorInfo {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSyncedAt: string | null;
  syncStatus: string;
  documentCount: number;
}

interface SyncProgress {
  step: string;
  progress: number;
  message: string;
  stats?: {
    found: number;
    created: number;
    updated: number;
    deleted: number;
    errors: number;
    skipped: number;
  };
}

const CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  'google-drive': <Cloud className="h-6 w-6 text-green-600" />,
  'microsoft-365': <FolderSync className="h-6 w-6 text-blue-600" />,
};

function formatTimeAgo(date: string | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ConnectorsSettingsPage() {
  const router = useRouter();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);
  const logger = useLogger('connectors');

  async function loadConnectors() {
    try {
      const res = await fetch('/api/connectors');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load connectors');
      }
      const data = (await res.json()) as ConnectorInfo[];
      setConnectors(data);
    } catch (err) {
      logger.error('Failed to load connectors', { err });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnectors();
  }, []);

  // Close EventSource on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Listen for popup messages
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'connector-connected' && event.data?.success) {
        setAuthenticating(null);
        loadConnectors();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function handleConnect(connectorId: string) {
    setAuthenticating(connectorId);
    try {
      const res = await fetch(`/api/connectors/auth?connectorId=${connectorId}`);
      if (!res.ok) throw new Error('Failed to get auth URL');
      const { url } = (await res.json()) as { url: string };

      // Open OAuth popup
      const popup = window.open(
        url,
        'oauth-popup',
        'width=600,height=700,scrollbars=yes',
      );

      if (!popup) {
        // Popup blocked — fall back to redirect
        window.location.assign(url);
      }
    } catch (err) {
      logger.error('Connect failed', { err });
      toast.error('Failed to connect');
      setAuthenticating(null);
    }
  }

  async function handleDisconnect(connectorId: string) {
    try {
      const res = await fetch(`/api/connectors/${connectorId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      await loadConnectors();
      toast.success('Connector disconnected');
      setShowDisconnectConfirm(false);
    } catch (err) {
      logger.error('Disconnect failed', { err });
      toast.error('Failed to disconnect');
    }
  }

  function handleSync(connectorId: string) {
    setSyncingId(connectorId);
    setSyncProgress(null);

    const eventSource = new EventSource(`/api/connectors/${connectorId}/sync`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SyncProgress | { type: string; stats?: unknown };
        if ('type' in data && data.type === 'complete') {
          setSyncProgress(null);
          setSyncingId(null);
          eventSource.close();
          loadConnectors();
        } else {
          setSyncProgress(data as SyncProgress);
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setSyncingId(null);
      setSyncProgress(null);
      eventSource.close();
      loadConnectors();
    };
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-semibold mb-2">Connectors</h1>
      <p className="text-muted-foreground mb-6">
        Connect external data sources to automatically sync documents.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading connectors...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {connectors.map((connector) => (
            <Card key={connector.id} data-testid={`connector-${connector.id}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2" aria-hidden="true">
                    {CONNECTOR_ICONS[connector.id]}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{connector.name}</CardTitle>
                    <CardDescription>
                      {connector.connected
                        ? `Last synced ${formatTimeAgo(connector.lastSyncedAt)}`
                        : 'Not connected'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connector.connected && (
                    <>
                      <Badge
                        variant={
                          connector.syncStatus === 'error' ? 'destructive' : 'secondary'
                        }
                      >
                        {connector.syncStatus === 'error' ? (
                          <AlertCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <CheckCircle className="mr-1 h-3 w-3" />
                        )}
                        {connector.syncStatus}
                      </Badge>
                      {connector.documentCount > 0 && (
                        <Badge variant="outline">
                          {connector.documentCount} docs
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {syncingId === connector.id && syncProgress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{syncProgress.message}</span>
                      <span>{syncProgress.progress}%</span>
                    </div>
                    <Progress value={syncProgress.progress} className="h-2" />
                    {syncProgress.stats && (
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Found: {syncProgress.stats.found}</span>
                        <span>Created: {syncProgress.stats.created}</span>
                        <span>Updated: {syncProgress.stats.updated}</span>
                        <span>Errors: {syncProgress.stats.errors}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {connector.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(connector.id)}
                        disabled={syncingId !== null}
                      >
                        <RefreshCw
                          className={`mr-1 h-4 w-4 ${syncingId === connector.id ? 'animate-spin' : ''}`}
                        />
                        Sync now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDisconnectTarget(connector.id);
                          setShowDisconnectConfirm(true);
                        }}
                        disabled={syncingId !== null}
                      >
                        <Unlink className="mr-1 h-4 w-4" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConnect(connector.id)}
                      disabled={authenticating === connector.id}
                    >
                      {authenticating === connector.id ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="mr-1 h-4 w-4" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title="Disconnect connector?"
        description={disconnectTarget ? `Disconnect ${disconnectTarget}? Synced documents will remain but stop updating.` : ''}
        confirmLabel="Disconnect"
        confirmVariant="destructive"
        onConfirm={() => handleDisconnect(disconnectTarget!)}
      />
    </div>
  );
}
