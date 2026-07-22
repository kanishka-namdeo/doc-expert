'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Pencil, Trash2, Share2, FileText, Download } from 'lucide-react';
import { useLogger } from '@/hooks/use-logger';
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
  const logger = useLogger('conversation-sidebar');
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
      logger.error('Failed to fetch conversations', { err: err as unknown });
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
        logger.error('Create conversation failed', { status: response.status, errorText });
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
      logger.error('Failed to create conversation', { err: err as unknown });
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
      logger.error('Failed to delete conversation', { err: err as unknown, conversationId: deleteTarget });
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
      logger.error('Failed to rename conversation', { err: err as unknown, conversationId: id });
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
                      <FileText className="h-2.5 w-2.5 text-muted-foreground" />
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
                      <Download className="h-3 w-3" />
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
