'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Pencil, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  onShare?: (conversationId: string) => void;
}

export function ConversationSidebar({ currentConversationId, setCurrentConversationId, onShare }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE', credentials: 'include' });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
      fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
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
    <div className="w-64 border-r flex flex-col h-screen">
      <div className="p-4 border-b">
        <Button onClick={handleCreate} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">No conversations</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative rounded-md p-2 text-sm cursor-pointer transition-colors ${
                currentConversationId === conv.id ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onClick={() => setCurrentConversationId(conv.id)}
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
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(conv.createdAt)}</div>
                  
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
                        handleDelete(conv.id);
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
  );
}
