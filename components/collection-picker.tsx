'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  docCount: number;
}

interface CollectionPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

export function CollectionPicker({ value, onChange }: CollectionPickerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  async function loadCollections() {
    try {
      const res = await fetch('/api/collections', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollections();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setCollections((prev) => [created, ...prev]);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="collection-select" className="text-sm text-muted-foreground hidden md:block">
        Collection:
      </label>
      <Select
        value={value ?? '__all__'}
        onValueChange={(val) => onChange(val === '__all__' ? null : String(val))}
      >
        <SelectTrigger id="collection-select" className="w-[200px]">
          <SelectValue placeholder="All Documents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Documents</SelectItem>
          {collections.map((col) => (
            <SelectItem key={col.id} value={col.id}>
              {col.name}
              <span className="ml-1 text-xs text-muted-foreground">({col.docCount})</span>
            </SelectItem>
          ))}
          <div className="border-t my-1" />
          <div className="flex gap-1 p-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New collection..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
