'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X, FileText, Eye } from 'lucide-react';
import { ListEmptyState, ListLoadingState, ListErrorState } from '@/components/list-empty-state';
import { DocumentPreview } from '@/components/document-preview';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface Document {
  id: string;
  fileName: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
  userId: string;
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{ documentId: string; action: 'approve' | 'reject' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch('/api/documents', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch documents');
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  async function handleReview(documentId: string, action: 'approve' | 'reject') {
    setReviewLoading(true);
    try {
      const body: Record<string, string> = { action };
      if (action === 'reject' && rejectionReason.trim()) {
        body.reason = rejectionReason.trim();
      }

      const res = await fetch(`/api/documents/${documentId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update document');

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: action === 'approve' ? 'approved' : 'rejected' }
            : doc
        )
      );
      setPendingReview(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Review failed:', err);
    } finally {
      setReviewLoading(false);
    }
  }

  const filteredDocuments = documents.filter((doc) =>
    filter === 'all' ? true : doc.status === filter
  );

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-500 text-yellow-50',
    approved: 'bg-green-500 text-green-50',
    rejected: 'bg-red-500 text-red-50',
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Document Review</h1>
            <p className="text-sm text-muted-foreground">
              Approve or reject uploaded documents
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? (
          <ListLoadingState message="Loading documents..." />
        ) : error ? (
          <ListErrorState error={error} />
        ) : filteredDocuments.length === 0 ? (
          <ListEmptyState
            message="No documents found"
            description={`No ${filter === 'all' ? '' : filter} documents match the current filter`}
            icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          />
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr className="text-left text-muted-foreground">
                  <th className="p-3">File Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{doc.fileName}</td>
                    <td className="p-3">
                      <Badge className={STATUS_COLORS[doc.status] || STATUS_COLORS.pending}>
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {doc.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewDocId(doc.id)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingReview({ documentId: doc.id, action: 'approve' })}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingReview({ documentId: doc.id, action: 'reject' })}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {doc.status !== 'pending' && (
                        <span className="text-xs text-muted-foreground">
                          Reviewed {doc.reviewedAt ? new Date(doc.reviewedAt).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentPreview
        documentId={previewDocId}
        onOpenChange={(open) => setPreviewDocId(open ? previewDocId : null)}
      />

      <ConfirmDialog
        open={!!pendingReview && pendingReview.action === 'approve'}
        onOpenChange={(open) => !open && setPendingReview(null)}
        title="Approve Document"
        description={`Approve "${documents.find(d => d.id === pendingReview?.documentId)?.fileName}"? This will make it available to users.`}
        confirmLabel="Approve"
        onConfirm={() => pendingReview ? handleReview(pendingReview.documentId, 'approve') : undefined}
        loading={reviewLoading}
      />

      <ConfirmDialog
        open={!!pendingReview && pendingReview.action === 'reject'}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReview(null);
            setRejectionReason('');
          }
        }}
        title="Reject Document"
        description={`Reject "${documents.find(d => d.id === pendingReview?.documentId)?.fileName}"? Optionally provide a reason.`}
        confirmLabel="Reject"
        confirmVariant="destructive"
        onConfirm={() => pendingReview ? handleReview(pendingReview.documentId, 'reject') : undefined}
        loading={reviewLoading}
      >
        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Rejection reason (optional)</label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none"
            rows={3}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
