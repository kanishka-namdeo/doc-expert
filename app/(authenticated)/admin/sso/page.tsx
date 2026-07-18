'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield, Lock, Save, Trash2, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageLoading } from '@/components/page-loading';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface SsoConfigData {
  entryPoint: string;
  idpCert: string;
  issuer: string;
  autoProvisioning: boolean;
  defaultRole: string;
}

interface SsoStatus {
  ssoEnabled: boolean;
  ssoProvider: string | null;
  config: SsoConfigData | null;
}

const DEFAULT_CONFIG: SsoConfigData = {
  entryPoint: '',
  idpCert: '',
  issuer: '',
  autoProvisioning: true,
  defaultRole: 'user',
};

export default function AdminSsoPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SsoStatus | null>(null);
  const [config, setConfig] = useState<SsoConfigData>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadConfig() {
    try {
      const res = await fetch('/api/admin/sso/config', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.');
          return;
        }
        throw new Error('Failed to fetch SSO config');
      }
      const data = await res.json();
      setStatus(data);
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch SSO config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content.includes('<EntityDescriptor')) {
        // Try to parse IdP metadata
        const entryPointMatch = content.match(/Location="([^"]+)"/);
        const certMatch = content.match(
          /<X509Certificate>\s*([^<]+)\s*<\/X509Certificate>/
        );

        if (entryPointMatch) {
          setConfig((prev) => ({ ...prev, entryPoint: entryPointMatch[1] }));
        }
        if (certMatch) {
          const cert = `-----BEGIN CERTIFICATE-----\n${certMatch[1].trim()}\n-----END CERTIFICATE-----`;
          setConfig((prev) => ({ ...prev, idpCert: cert }));
        }
        setSuccess('IdP metadata parsed successfully');
      } else {
        setConfig((prev) => ({ ...prev, idpCert: content }));
        setSuccess('Certificate loaded');
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function validateConfig(): string | null {
    if (!config.entryPoint || !config.entryPoint.startsWith('http')) {
      return 'Entry Point must be a valid URL';
    }
    if (!config.idpCert || !config.idpCert.includes('-----BEGIN')) {
      return 'IdP Certificate must be a valid PEM-encoded certificate';
    }
    if (!config.issuer) {
      return 'Issuer is required';
    }
    return null;
  }

  async function handleSave() {
    setValidationError(null);
    setSuccess(null);

    const validationErr = validateConfig();
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/sso/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      toast.success('SSO configuration saved successfully');
      loadConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/sso/config', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to disable SSO');
      }

      toast.success('SSO disabled');
      setShowDeleteConfirm(false);
      loadConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLoading message="Loading SSO configuration..." />;
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
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Single Sign-On</h1>
            <p className="text-sm text-muted-foreground">
              Configure SAML 2.0 SSO for your organization
            </p>
          </div>
        </div>

        {/* Status Banner */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {status?.ssoEnabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">SSO Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Protocol: {status.ssoProvider?.toUpperCase() || 'SAML'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">SSO Not Configured</p>
                    <p className="text-sm text-muted-foreground">
                      Configure SAML 2.0 to enable SSO login
                    </p>
                  </div>
                </>
              )}
            </div>
            {status?.ssoEnabled && (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                Active
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Identity Provider Settings
            </CardTitle>
            <CardDescription>
              Enter your IdP metadata. You can upload an XML metadata file or paste values manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metadata Upload */}
            <div className="space-y-2">
              <Label>IdP Metadata (XML file)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.cer,.crt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload XML
                </Button>
                <span className="text-sm text-muted-foreground">
                  Upload IdP metadata to auto-fill fields below
                </span>
              </div>
            </div>

            {/* Entry Point */}
            <div className="space-y-2">
              <Label htmlFor="entryPoint">SSO URL (Entry Point)</Label>
              <Input
                id="entryPoint"
                value={config.entryPoint}
                onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })}
                placeholder="https://your-idp.com/saml/sso"
                disabled={saving}
              />
            </div>

            {/* Issuer */}
            <div className="space-y-2">
              <Label htmlFor="issuer">Entity ID (Issuer)</Label>
              <Input
                id="issuer"
                value={config.issuer}
                onChange={(e) => setConfig({ ...config, issuer: e.target.value })}
                placeholder="https://your-org.example.com"
                disabled={saving}
              />
            </div>

            {/* IdP Certificate */}
            <div className="space-y-2">
              <Label htmlFor="idpCert">IdP Certificate (PEM)</Label>
              <textarea
                id="idpCert"
                value={config.idpCert}
                onChange={(e) => setConfig({ ...config, idpCert: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                disabled={saving}
              />
            </div>

            {/* Divider */}
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">User Provisioning</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="autoProvisioning" className="cursor-pointer">
                    Auto-provision new users
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create accounts for new SSO users
                  </p>
                </div>
                <Switch
                  id="autoProvisioning"
                  checked={config.autoProvisioning}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, autoProvisioning: checked })
                  }
                  disabled={saving}
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="defaultRole">Default role for new users</Label>
                <Select
                  value={config.defaultRole}
                  onValueChange={(value) =>
                    setConfig({ ...config, defaultRole: value as string })
                  }
                  disabled={saving}
                >
                  <SelectTrigger id="defaultRole" className="w-[200px]">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert className="bg-green-500/10 border-green-500 text-green-700 dark:text-green-400">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              {status?.ssoEnabled && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting || saving}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Disable SSO
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Disable SSO?"
          description="Users will no longer be able to log in via SSO. This action can be reversed by reconfiguring SSO."
          confirmLabel="Disable SSO"
          confirmVariant="destructive"
          onConfirm={handleDelete}
          loading={deleting}
        />

        {/* SP Metadata Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Service Provider Information</CardTitle>
            <CardDescription>
              Provide this information to your Identity Provider administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <p className="text-muted-foreground">ACS (Callback) URL:</p>
              <p className="mt-1 break-all">
                {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
                /api/auth/sso/callback
              </p>
            </div>
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <p className="text-muted-foreground">Entity ID (Audience URI):</p>
              <p className="mt-1 break-all">
                {process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: This application uses HTTP-POST binding for SAML. Ensure your
              IdP is configured to send SAML responses via POST to the ACS URL.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
