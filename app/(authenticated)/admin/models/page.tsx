'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Cpu, Trash2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
    context_length: number;
    embedding_length: number;
  };
  capabilities: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return 'Unknown';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function AdminModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatus] = useState('');
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadModels() {
    try {
      const res = await fetch('/api/admin/models', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.');
          return;
        }
        throw new Error('Failed to fetch models');
      }
      const data = await res.json();
      setModels(data.models ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }

  async function loadDefaultModel() {
    try {
      const res = await fetch('/api/admin/models/default', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDefaultModel(data.model);
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    loadModels();
    loadDefaultModel();
  }, []);

  async function handlePull() {
    if (!pullName.trim()) return;
    setPulling(true);
    setPullProgress(0);
    setPullStatus('');

    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullName }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPullStatus(`Error: ${err.error}`);
        setPulling(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Try to parse as JSON for progress updates
          const lines = chunk.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.status === 'success') {
                setPullProgress(100);
                setPullStatus('Pull complete!');
              } else if (parsed.completed && parsed.total) {
                const pct = Math.round((parsed.completed / parsed.total) * 100);
                setPullProgress(pct);
                setPullStatus(`Downloading... ${pct}%`);
              } else if (parsed.status) {
                setPullStatus(parsed.status);
              }
            } catch {
              // Non-JSON line, ignore
            }
          }
        }
      }

      setPullName('');
      setPulling(false);
      loadModels();
    } catch (err) {
      setPullStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPulling(false);
    }
  }

  async function handleSetDefault(modelName: string) {
    setSettingDefault(modelName);
    try {
      const res = await fetch('/api/admin/models/default', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
      });
      if (res.ok) {
        setDefaultModel(modelName);
      }
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleDelete(modelName: string) {
    if (!confirm(`Delete model "${modelName}"? This cannot be undone.`)) return;

    setDeleting(modelName);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.name !== modelName));
      } else {
        const err = await res.json();
        alert(`Delete failed: ${err.error}`);
      }
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4">{error}</div>
          <Link href="/admin">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Model Management</h1>
            <p className="text-sm text-muted-foreground">Manage Ollama models and default settings</p>
          </div>
        </div>

        {/* Pull Model Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pull New Model</CardTitle>
            <CardDescription>Download a new model from Ollama</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  value={pullName}
                  onChange={(e) => setPullName(e.target.value)}
                  placeholder="e.g. llama3.1:8b"
                  disabled={pulling}
                />
              </div>
              <Button onClick={handlePull} disabled={pulling || !pullName.trim()}>
                {pulling ? 'Pulling...' : 'Pull Model'}
              </Button>
            </div>
            {pulling && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{pullStatus || 'Pulling...'}</span>
                  <span>{pullProgress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${pullProgress}%` }}
                  />
                </div>
              </div>
            )}
            {!pulling && pullStatus && (
              <div className="mt-2 text-sm text-muted-foreground">{pullStatus}</div>
            )}
          </CardContent>
        </Card>

        {/* Models Table */}
        <Card>
          <CardHeader>
            <CardTitle>Installed Models</CardTitle>
            <CardDescription>{models.length} model{models.length !== 1 ? 's' : ''} available</CardDescription>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No models installed. Pull a model to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Quantization</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.name}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>{formatBytes(model.size)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{model.details.family}</Badge>
                      </TableCell>
                      <TableCell>{model.details.quantization_level}</TableCell>
                      <TableCell>
                        {defaultModel === model.name ? (
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 flex items-center gap-1 w-fit">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(model.name)}
                            disabled={settingDefault !== null}
                          >
                            {settingDefault === model.name ? '...' : 'Set Default'}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(model.name)}
                          disabled={deleting !== null}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
