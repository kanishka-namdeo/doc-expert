'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { X, UserSearch, Group, Loader2 } from 'lucide-react';

interface ShareUser {
  id: string;
  name: string | null;
  email: string;
}

interface ShareGroup {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
}

interface ShareEntry {
  id: string;
  type: 'user' | 'group';
  permission: 'read' | 'write';
  user: ShareUser | null;
  group: ShareGroup | null;
}

interface ShareDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PermissionLevel = 'read' | 'write';

export function ShareDialog({ conversationId, open, onOpenChange }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState<'people' | 'groups'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareUser[]>([]);
  const [groupSearchResults, setGroupSearchResults] = useState<ShareGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [grantPermission, setGrantPermission] = useState<PermissionLevel>('read');

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0 && activeTab === 'people') {
        searchUsers(searchQuery);
      } else if (activeTab === 'people') {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Debounced group search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0 && activeTab === 'groups') {
        searchGroups(searchQuery);
      } else if (activeTab === 'groups') {
        setGroupSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const searchUsers = async (query: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSearchLoading(false);
    }
  };

  const searchGroups = async (query: string) => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/groups?search=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setGroupSearchResults(data.groups || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchShares = useCallback(async () => {
    setSharesLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSharesLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open && conversationId) {
      fetchShares();
    }
  }, [open, conversationId, fetchShares]);

  const handleGrantPermission = async (targetUserId?: string, targetGroupId?: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          targetUserId,
          targetGroupId,
          permission: grantPermission,
        }),
      });

      if (res.ok) {
        setSuccess(targetUserId ? 'Shared with user' : 'Shared with group');
        setSearchQuery('');
        setSearchResults([]);
        setGroupSearchResults([]);
        fetchShares();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to share');
      }
    } catch {
      setError('Failed to share');
    }
  };

  const handleRevoke = async (shareId: string) => {
    // Need to determine if it's a user or group share to call unshare correctly
    const share = shares.find(s => s.id === shareId);
    if (!share) return;

    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unshare',
          targetUserId: share.type === 'user' ? share.user?.id : undefined,
          targetGroupId: share.type === 'group' ? share.group?.id : undefined,
        }),
      });

      if (res.ok) {
        fetchShares();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to revoke');
      }
    } catch {
      setError('Failed to revoke');
    }
  };

  const handleChangePermission = async (shareId: string, newPermission: PermissionLevel) => {
    const share = shares.find(s => s.id === shareId);
    if (!share) return;

    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          targetUserId: share.type === 'user' ? share.user?.id : undefined,
          targetGroupId: share.type === 'group' ? share.group?.id : undefined,
          permission: newPermission,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update permission');
      } else {
        fetchShares();
      }
    } catch {
      setError('Failed to update permission');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Grant Permission Level (shared between People/Groups) */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Grant permission:</span>
            <Select
              value={grantPermission}
              onValueChange={(v) => setGrantPermission(v as PermissionLevel)}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="write">Write</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs: People / Groups */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'people' | 'groups');
              setSearchQuery('');
              setSearchResults([]);
              setGroupSearchResults([]);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-3">
              {/* Search users */}
              <div className="relative">
                <UserSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email..."
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-md bg-popover max-h-40 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleGrantPermission(user.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                    >
                      <span className="font-medium">{user.name || user.email}</span>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim().length > 0 && searchResults.length === 0 && !searchLoading && (
                <p className="text-sm text-muted-foreground">No users found</p>
              )}
            </TabsContent>

            <TabsContent value="groups" className="space-y-3">
              {/* Search groups */}
              <div className="relative">
                <Group className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups..."
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              {groupSearchResults.length > 0 && (
                <div className="border rounded-md bg-popover max-h-40 overflow-y-auto">
                  {groupSearchResults.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleGrantPermission(undefined, group.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                    >
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                          {group.description ? ` • ${group.description}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim().length > 0 && groupSearchResults.length === 0 && !searchLoading && (
                <p className="text-sm text-muted-foreground">No groups found</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Status Messages */}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          {/* Current Shares */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Shared with</label>
            {sharesLoading ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading...
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not shared with anyone</p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 p-2 border rounded-md"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {share.type === 'group' ? (
                          <Group className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <UserSearch className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="font-medium text-sm truncate">
                          {share.type === 'user'
                            ? share.user?.name || share.user?.email
                            : share.group?.name}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate pl-6">
                        {share.type === 'user'
                          ? share.user?.email
                          : `${share.group?.memberCount || 0} members`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(v) =>
                          handleChangePermission(share.id, v as PermissionLevel)
                        }
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Read</SelectItem>
                          <SelectItem value="write">Write</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRevoke(share.id)}
                        title="Remove access"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
