'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';
import { ListEmptyState, ListErrorState, ListLoadingState } from '@/components/list-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  docCount: number;
}

export function CollectionList({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const logger = useLogger('collection-list');

  async function fetchCollections() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/collections', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err) {
      logger.error('Failed to load collections', { err: err instanceof Error ? err.message : String(err) });
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCollections();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create collection');
      }

      const created = await response.json();
      setCollections((prev) => [{ ...created, id: created.id } as Collection, ...prev]);
      setNewName('');
      setNewDescription('');
      setCreateOpen(false);
      toast.success(`Collection "${created.name}" created`);
    } catch (err) {
      logger.error('Failed to create collection', { err: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/collections/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete collection');

      setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.name}"`);
    } catch (err) {
      logger.error('Failed to delete collection', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete collection');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  function openDeleteDialog(collection: Collection) {
    setDeleteTarget(collection);
    setShowDeleteConfirm(true);
  }

  function handleCollectionClick(collectionId: string) {
    router.push(`/collections/${collectionId}`);
  }

  const content = (
    <>
      {loading && <ListLoadingState />}
      {!loading && error && <ListErrorState error={error} onRetry={fetchCollections} />}

      {!loading && !error && collections.length === 0 && (
        <ListEmptyState
          message="No collections yet"
          description="Create a collection to organize documents for scoped Q&A sessions"
          icon={<FolderOpen className="h-10 w-10 text-muted-foreground" />}
          action={{
            label: 'Create Collection',
            onClick: () => setCreateOpen(true),
          }}
        />
      )}

      {!loading && collections.length > 0 && (
        <ul className="space-y-2">
          {collections.map((collection) => (
            <li key={collection.id} className="group relative" data-testid="collection-row">
              <button
                onClick={() => handleCollectionClick(collection.id)}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-sm">{collection.name}</p>
                      {collection.docCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {collection.docCount} doc{collection.docCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {collection.description && (
                      <p className="truncate text-xs text-muted-foreground mt-0.5">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteDialog(collection);
                }}
                disabled={deletingId === collection.id}
              >
                {deletingId === collection.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (standalone) {
    return (
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Collections</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>
        {content}

        <CreateCollectionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          name={newName}
          description={newDescription}
          onNameChange={setNewName}
          onDescriptionChange={setNewDescription}
          onCreate={handleCreate}
          loading={creating}
        />

        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete collection?"
          description={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.name}"? This will remove the collection but not the documents inside it.`
              : ''
          }
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={handleDelete}
          loading={deletingId === deleteTarget?.id}
        />
      </div>
    );
  }

  return (
    <>
      {content}

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        description={newDescription}
        onNameChange={setNewName}
        onDescriptionChange={setNewDescription}
        onCreate={handleCreate}
        loading={creating}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete collection?"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will remove the collection but not the documents inside it.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deletingId === deleteTarget?.id}
      />
    </>
  );
}

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onCreate: () => void;
  loading: boolean;
}

function CreateCollectionDialog({
  open,
  onOpenChange,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCreate,
  loading,
}: CreateCollectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Create a new collection to organize documents for scoped Q&A sessions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="collection-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="collection-name"
              placeholder="My Collection"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="collection-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="collection-description"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={loading || !name.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
