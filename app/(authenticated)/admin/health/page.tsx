'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Server, Cpu } from 'lucide-react';

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  model?: string;
  error?: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    qdrant: ServiceStatus;
    database: ServiceStatus;
    llm: ServiceStatus;
  };
}

const STATUS_COLORS = {
  healthy: 'bg-green-500 text-green-50',
  degraded: 'bg-yellow-500 text-yellow-50',
  unhealthy: 'bg-red-500 text-red-50',
};

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health', { credentials: 'include' });
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const services = [
    {
      name: 'Qdrant (Vector Store)',
      icon: Database,
      status: health?.services.qdrant,
      description: 'Document embeddings and vector search',
    },
    {
      name: 'SQLite (Database)',
      icon: Server,
      status: health?.services.database,
      description: 'User data, conversations, and audit logs',
    },
    {
      name: `LLM (${health?.services.llm?.model || 'Unknown'})`,
      icon: Cpu,
      status: health?.services.llm,
      description: 'AI model for chat responses',
    },
  ];

  if (loading && !health) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">System Health</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6">
          <Badge className={STATUS_COLORS[(health?.status as keyof typeof STATUS_COLORS) || 'healthy']}>
            Overall Status: {health?.status || 'unknown'}
          </Badge>
        </div>

        <div className="grid gap-4">
          {services.map((service) => (
            <Card key={service.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <service.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {service.status?.latency && (
                    <span className="text-xs text-muted-foreground">
                      {service.status.latency}ms
                    </span>
                  )}
                  <Badge
                    className={
                      STATUS_COLORS[service.status?.status || 'unhealthy'] || STATUS_COLORS.unhealthy
                    }
                  >
                    {service.status?.status || 'unknown'}
                  </Badge>
                </div>
              </CardHeader>
              {service.status?.error && (
                <CardContent>
                  <p className="text-sm text-destructive">{service.status.error}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
