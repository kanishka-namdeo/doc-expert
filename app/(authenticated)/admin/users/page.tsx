'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListEmptyState, ListLoadingState } from '@/components/list-empty-state';
import { Users, Search } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: number;
  updatedAt: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ userId: string; userDisplayName: string; fromRole: string; toRole: string } | null>(null);
  const [roleChanging, setRoleChanging] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.');
          return;
        }
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleRoleChange = async () => {
    if (!roleChangeConfirm) return;
    setRoleChanging(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: roleChangeConfirm.userId, role: roleChangeConfirm.toRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setEditingUser(null);
      setNewRole('');
      setRoleChangeConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setRoleChanging(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'viewer':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">User Management</h1>
            <p className="text-sm text-muted-foreground">View and manage user accounts</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search by email or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-48">
                <Label htmlFor="role">Role</Label>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as string)}>
                  <SelectTrigger id="role" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users
                </CardTitle>
                <CardDescription>
                  {pagination && `${pagination.total} user${pagination.total !== 1 ? 's' : ''} found`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListLoadingState message="Loading users..." />
            ) : users.length === 0 ? (
              <ListEmptyState message="No users found" description="Add users to get started" />
            ) : (
              <>
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name || 'Unnamed'}</span>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        {editingUser === user.id ? (
                          <div className="flex gap-2">
                            <Select value={newRole} onValueChange={(v) => setNewRole(v as string)}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" onClick={() => {
                              if (!newRole || newRole === user.role) return;
                              setRoleChangeConfirm({
                                userId: user.id,
                                userDisplayName: user.name || user.email,
                                fromRole: user.role,
                                toRole: newRole,
                              });
                            }}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUser(null);
                                setNewRole('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUser(user.id);
                              setNewRole(user.role);
                            }}
                          >
                            Change Role
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!roleChangeConfirm}
        onOpenChange={(open) => !open && setRoleChangeConfirm(null)}
        title="Confirm Role Change"
        description={`Change ${roleChangeConfirm?.userDisplayName} from ${roleChangeConfirm?.fromRole} to ${roleChangeConfirm?.toRole}?`}
        confirmLabel="Change Role"
        onConfirm={handleRoleChange}
        loading={roleChanging}
      />
    </div>
  );
}
