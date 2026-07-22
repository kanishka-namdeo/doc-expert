'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { getLogger } from '@/lib/logger';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';
import { Loader2, User } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const log = useLogger('profile');
  const [name, setName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    conversations: number;
    dateRange: { start: string; end: string };
    conflicts: number;
  } | null>(null);
  const [pendingImportData, setPendingImportData] = useState<unknown>(null);
  const [isImporting, setIsImporting] = useState(false);
  const handleChangeName = async () => {
    if (!name.trim()) return;
    setNameLoading(true);
    try {
      const { error } = await authClient.updateUser({ name: name.trim() });
      if (error) {
        toast.error(error.message || 'Failed to update name');
        log.error('Name update failed', { err: error });
      } else {
        toast.success('Name updated successfully');
        log.info('Name updated successfully');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
      log.error('Name update error', { err });
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
      });

      if (error) {
        setError(error.message || 'Failed to change password');
        log.error('Password change failed', { err: error });
      } else {
        setSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        log.info('Password changed successfully');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      log.error('Password change error', { err });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        log.info('Account deleted successfully');
        router.push('/login');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete account');
        log.error('Account deletion failed', { error: data.error });
      }
    } catch (err) {
      setError('An unexpected error occurred');
      log.error('Account deletion error', { err });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Account Settings" description="Manage your account preferences" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">

      {/* Personal Info Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Info
          </CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={nameLoading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleChangeName} disabled={nameLoading || !name.trim()}>
                {nameLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data Export / Import */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or import your account data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch('/api/account/export', { credentials: 'include' });
                  if (!res.ok) throw new Error('Export failed');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'doc-expert-export.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Data exported successfully');
                } catch (err) {
                  log.error('Export failed', { err });
                  toast.error('Export failed');
                }
              }}
            >
              Export My Data
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const data = JSON.parse(text);

                    // Fetch preview before importing
                    const previewRes = await fetch('/api/account/import/preview', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data),
                    });

                    if (!previewRes.ok) {
                      const err = await previewRes.json();
                      throw new Error(err.error || 'Preview failed');
                    }

                    const preview = await previewRes.json();
                    setImportPreview(preview);
                    setPendingImportData(data);
                  } catch (err) {
                    log.error('Import preview failed', { err });
                    toast.error('Import preview failed: ' + (err instanceof Error ? err.message : String(err)));
                  }
                };
                input.click();
              }}
            >
              Import Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={(open) => { if (!open) { setImportPreview(null); setPendingImportData(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>Review the data before importing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Conversations</span>
              <span className="text-sm font-medium">{importPreview?.conversations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Date range</span>
              <span className="text-sm font-medium">
                {importPreview?.dateRange.start
                  ? `${new Date(importPreview.dateRange.start).toLocaleDateString()} – ${new Date(importPreview.dateRange.end).toLocaleDateString()}`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Conflicts (existing)</span>
              <span className={`text-sm font-medium ${importPreview?.conflicts ? 'text-amber-600' : ''}`}>
                {importPreview?.conflicts ?? 0}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportPreview(null); setPendingImportData(null); }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsImporting(true);
                try {
                  const res = await fetch('/api/account/import', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pendingImportData),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Import failed');
                  }
                  const result = await res.json();
                  toast.success(`${result.imported} conversations imported, ${result.skipped} skipped.`);
                } catch (err) {
                  log.error('Import failed', { err });
                  toast.error('Import failed: ' + (err instanceof Error ? err.message : String(err)));
                } finally {
                  setIsImporting(false);
                  setImportPreview(null);
                  setPendingImportData(null);
                }
              }}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This action cannot be undone. All your documents, chat history, and account data will be permanently deleted.
          </p>
          <Button
            variant="destructive"
            disabled={isLoading}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Account
          </Button>
          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setError(''); }}
            title="Delete account?"
            description="This action cannot be undone. All your documents, chat history, and account data will be permanently deleted."
            confirmLabel="Delete Account"
            confirmVariant="destructive"
            onConfirm={handleDeleteAccount}
            loading={isLoading}
          />
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
