'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Pencil, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListEmptyState, ListLoadingState } from '@/components/list-empty-state';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  collectionId?: string | null;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  onShare?: (conversationId: string) => void;
}

export function ConversationSidebar({ currentConversationId, setCurrentConversationId, selectedCollectionId, setSelectedCollectionId, onShare }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/conversations', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          setConversations([]);
          return;
        }
        throw new Error('Failed to fetch conversations');
      }
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleCreate = async (collectionId?: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation', collectionId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create conversation failed:', response.status, errorText);
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to create conversation: ${response.status}`);
      }

      const data = await response.json();
      const newId = data.conversation.id;
      setCurrentConversationId(newId);
      fetchConversations();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTarget(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/conversations/${deleteTarget}`, { method: 'DELETE', credentials: 'include' });
      if (currentConversationId === deleteTarget) {
        setCurrentConversationId(null);
      }
      fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      setEditingId(null);
      fetchConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
    <div className="w-64 border-r flex flex-col h-screen">
      <div className="p-4 border-b">
        <Button onClick={() => handleCreate(selectedCollectionId ?? undefined)} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <ListLoadingState message="Loading..." />
        ) : conversations.length === 0 ? (
          <ListEmptyState
            message="No conversations"
            description="Start a new chat to begin"
            icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />}
          />
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative rounded-md p-2 text-sm cursor-pointer transition-colors ${
                currentConversationId === conv.id ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                setCurrentConversationId(conv.id);
                if (conv.collectionId) {
                  setSelectedCollectionId(conv.collectionId);
                }
              }}
            >
              {editingId === conv.id ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(conv.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="h-6 text-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate flex-1">{conv.title}</span>
                  </div>
                  {conv.collectionId && (
                    <div className="flex items-center gap-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
                      <span className="text-[10px] text-muted-foreground truncate">Collection</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDate(conv.createdAt)}</div>
                  
                  <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare?.(conv.id);
                      }}
                      title="Share"
                    >
                      <Share2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditTitle(conv.title);
                      }}
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/conversations/${conv.id}/export`, '_blank');
                      }}
                      title="Export"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(conv.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    <ConfirmDialog
      open={showDeleteConfirm}
      onOpenChange={setShowDeleteConfirm}
      title="Delete conversation?"
      description="This will permanently delete this conversation and all its messages."
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={confirmDelete}
    />
    </>
  );
}
