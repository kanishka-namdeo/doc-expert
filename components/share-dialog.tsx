'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, UserSearch, Loader2 } from 'lucide-react';

interface ShareUser {
  id: string;
  name: string | null;
  email: string;
}

interface Share {
  id: string;
  userId: string;
  permission: 'read' | 'write';
  createdAt: string;
  user: ShareUser;
}

interface ShareDialogProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ conversationId, open, onOpenChange }: ShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const handleShare = async (targetUser: ShareUser) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          targetUserId: targetUser.id,
          permission: 'read',
        }),
      });

      if (res.ok) {
        setSuccess(`Shared with ${targetUser.email}`);
        setSearchQuery('');
        setSearchResults([]);
        fetchShares();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to share');
      }
    } catch {
      setError('Failed to share');
    }
  };

  const handleUpdatePermission = async (shareId: string, userId: string, permission: 'read' | 'write') => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          targetUserId: userId,
          permission,
        }),
      });

      if (res.ok) {
        fetchShares();
      }
    } catch {
      // Silently fail
    }
  };

  const handleUnshare = async (userId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unshare',
          targetUserId: userId,
        }),
      });

      if (res.ok) {
        fetchShares();
      }
    } catch {
      // Silently fail
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add people</label>
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
                    onClick={() => handleShare(user)}
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
          </div>

          {/* Status Messages */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

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
                      <div className="font-medium text-sm truncate">
                        {share.user.name || share.user.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {share.user.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={share.permission === 'write' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {share.permission}
                      </Badge>

                      <Select
                        value={share.permission}
                        onValueChange={(value) =>
                          handleUpdatePermission(share.id, share.userId, value as 'read' | 'write')
                        }
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
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
                        onClick={() => handleUnshare(share.userId)}
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
