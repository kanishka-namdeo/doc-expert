'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FolderOpen, Trash2, Loader2, ArrowLeft, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLogger } from '@/hooks/use-logger';
import { toast } from 'sonner';
import { ListEmptyState, ListErrorState, ListLoadingState } from '@/components/list-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DocumentPicker } from '@/components/document-picker';
import { useOnboardingHints } from '@/hooks/use-onboarding-hints';

interface Document {
  id: string;
  fileName: string;
  mediaType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  documents: Document[];
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [removingDocId, setRemovingDocId] = useState<string | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const logger = useLogger('collection-detail');
  const { updateContext: updateHintContext } = useOnboardingHints();

  async function fetchCollection() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/collections/${collectionId}`, { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 404) throw new Error('Collection not found or access denied');
        throw new Error('Failed to fetch collection');
      }
      const data = await response.json();
      setCollection(data.collection);
      setEditName(data.collection.name);
      setEditDescription(data.collection.description || '');
      updateHintContext({ collectionDocumentCount: data.collection.documents?.length ?? 0 });
    } catch (err) {
      logger.error('Failed to load collection', { err: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCollection();
  }, [collectionId]);

  async function handleSave() {
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update collection');

      await fetchCollection();
      setEditing(false);
      toast.success('Collection updated');
    } catch (err) {
      logger.error('Failed to update collection', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to update collection');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete collection');

      toast.success('Collection deleted');
      router.push('/collections');
    } catch (err) {
      logger.error('Failed to delete collection', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete collection');
      setDeleting(false);
    }
  }

  async function handleRemoveDocument(documentId: string) {
    setRemovingDocId(documentId);
    try {
      const response = await fetch(`/api/collections/${collectionId}/documents?documentId=${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to remove document');

      setCollection((prev) =>
        prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== documentId) } : null
      );
      toast.success('Document removed from collection');
    } catch (err) {
      logger.error('Failed to remove document', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to remove document');
    } finally {
      setRemovingDocId(null);
    }
  }

  async function handleAddDocuments(documentIds: string[]) {
    setAddingDoc(true);
    let added = 0;
    let failed = 0;
    try {
      for (const documentId of documentIds) {
        try {
          const response = await fetch(`/api/collections/${collectionId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ documentId }),
          });
          if (response.ok) {
            added++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      if (added > 0) {
        await fetchCollection();
        toast.success(`${added} document${added !== 1 ? 's' : ''} added to collection`);
      }
      if (failed > 0) {
        toast.error(`${failed} document${failed !== 1 ? 's' : ''} could not be added (may already exist)`);
      }
      setShowAddDoc(false);
    } catch (err) {
      logger.error('Failed to add documents', { err: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to add documents');
    } finally {
      setAddingDoc(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {loading || error ? (
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          ) : editing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-base font-semibold"
              disabled={saving}
            />
          ) : (
            <h1 className="text-lg font-semibold truncate">{collection?.name}</h1>
          )}
          {collection && !editing && collection.description && (
            <p className="text-xs text-muted-foreground truncate">{collection.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Saving
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditName(collection?.name || ''); setEditDescription(collection?.description || ''); }}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                <Trash2 className="mr-1 h-3 w-3 text-destructive" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Stats */}
          {!loading && collection && (
            <div className="flex gap-4">
              <div className="rounded-lg border p-3 flex-1 text-center">
                <p className="text-2xl font-bold">{collection.documents.length}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          )}

          {/* Documents Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Documents</h2>
              <Button variant="outline" size="sm" onClick={() => setShowAddDoc(true)}>
                Add Document
              </Button>
            </div>

            {loading && <ListLoadingState />}
            {!loading && error && <ListErrorState error={error} onRetry={fetchCollection} />}
            {!loading && !error && (!collection || collection.documents.length === 0) && (
              <ListEmptyState
                message="This collection is empty"
                description="Add documents to start asking scoped questions"
                icon={<FolderOpen className="h-10 w-10 text-muted-foreground" />}
                action={{
                  label: 'Add documents',
                  onClick: () => setShowAddDoc(true),
                }}
                secondaryActions={[
                  { label: 'Browse your documents', onClick: () => router.push('/documents') },
                ]}
              />
            )}

            {!loading && collection && collection.documents.length > 0 && (
              <ul className="space-y-2">
                {collection.documents.map((doc) => (
                  <li key={doc.id} className="group relative flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate font-medium text-sm">{doc.fileName}</p>
                        {doc.status && doc.status !== 'approved' && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                            {doc.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => handleRemoveDocument(doc.id)}
                      disabled={removingDocId === doc.id}
                    >
                      {removingDocId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Add Document Picker */}
      <DocumentPicker
        open={showAddDoc}
        onOpenChange={setShowAddDoc}
        onSelect={handleAddDocuments}
        excludeIds={collection?.documents.map(d => d.id) || []}
        loading={addingDoc}
      />

      {/* Delete Collection Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete collection?"
        description={`Are you sure you want to delete "${collection?.name}"? This will remove the collection but not the documents inside it.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
