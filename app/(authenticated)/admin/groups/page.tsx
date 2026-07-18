'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Group, Plus, Loader2, UserPlus, X, Trash2, Search } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';

interface GroupInfo {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

interface User {
  id: string;
  userId: string;
  email: string;
  name: string | null;
}

export default function AdminGroupsPage() {
  const router = useRouter();
  const logger = useLogger('admin-groups');
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroupInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memberSheetGroup, setMemberSheetGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<{ userId: string; userEmail: string } | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/groups', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.');
          return;
        }
        throw new Error('Failed to fetch groups');
      }
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Debounced member search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (memberSearch.trim().length > 0) {
        searchUsers(memberSearch);
      } else {
        setMemberSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  const searchUsers = async (query: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMemberSearchResults(data.users || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchMembers = async (groupId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      logger.error('Failed to fetch members', { err });
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }
      setCreateOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      fetchGroups();
      toast.success('Group created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !editName.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update group');
      }
      setEditingGroup(null);
      fetchGroups();
      toast.success('Group updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/groups/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete group');
      }
      setDeleteTarget(null);
      fetchGroups();
      toast.success('Group deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!memberSheetGroup) return;
    try {
      const res = await fetch(`/api/admin/groups/${memberSheetGroup.id}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add member');
      }
      setMemberSearch('');
      setMemberSearchResults([]);
      fetchGroups();
      fetchMembers(memberSheetGroup.id);
      toast.success('Member added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async () => {
    if (!memberSheetGroup || !removeConfirmTarget) return;
    const { userId } = removeConfirmTarget;
    setRemovingMember(true);
    try {
      const res = await fetch(
        `/api/admin/groups/${memberSheetGroup.id}/members?userId=${userId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      setRemoveConfirmTarget(null);
      fetchGroups();
      fetchMembers(memberSheetGroup.id);
      toast.success('Member removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  const openMemberSheet = (group: GroupInfo) => {
    setMemberSheetGroup(group);
    setMembers([]);
    setMemberSearch('');
    setMemberSearchResults([]);
    fetchMembers(group.id);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Group Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage groups and their members
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Group className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p>No groups yet. Create your first group to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} data-testid="group-row" data-group-id={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <Group className="h-5 w-5 text-muted-foreground" />
                        {group.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {group.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{group.memberCount} members</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMemberSheet(group)}
                    >
                      <UserPlus className="mr-2 h-3 w-3" />
                      Members
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingGroup(group);
                        setEditName(group.name);
                        setEditDesc(group.description || '');
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(group)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Created {new Date(group.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Create a new group to manage document access for multiple users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Engineering Team"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="e.g., All engineering department members"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={updating || !editName.trim()}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Remove all {deleteTarget?.memberCount} members from the group</li>
            <li>Revoke all document permissions granted via this group</li>
            <li>Update access control lists for affected documents</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Management Sheet */}
      <Sheet
        open={!!memberSheetGroup}
        onOpenChange={(open) => !open && setMemberSheetGroup(null)}
      >
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>
              {memberSheetGroup?.name} — Members
            </SheetTitle>
            <SheetDescription>
              {memberSheetGroup?.description || 'Manage group members'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Add Member */}
            <div className="space-y-2">
              <Label>Add Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by email..."
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {memberSearchResults.length > 0 && (
                <div className="border rounded-md bg-popover max-h-40 overflow-y-auto">
                  {memberSearchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMember(user.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                    >
                      <span className="font-medium">{user.name || user.email}</span>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Member List */}
            <div className="space-y-2">
              <Label>Current Members</Label>
              {membersLoading ? (
                <div className="text-center text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Loading...
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 border rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {member.name || member.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveConfirmTarget({ userId: member.userId, userEmail: member.email })}
                        title="Remove member"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!removeConfirmTarget}
        onOpenChange={(open) => !open && setRemoveConfirmTarget(null)}
        title="Remove Member"
        description={`Remove ${removeConfirmTarget?.userEmail} from ${memberSheetGroup?.name}? This will revoke their group-based document permissions.`}
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={handleRemoveMember}
        loading={removingMember}
      />
    </div>
  );
}
