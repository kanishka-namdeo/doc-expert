'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X } from 'lucide-react';

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
    try {
      const res = await fetch(`/api/documents/${documentId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to update document');

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? { ...doc, status: action === 'approve' ? 'approved' : 'rejected' }
            : doc
        )
      );
    } catch (err) {
      console.error('Review failed:', err);
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
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
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
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">{error}</div>
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
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(doc.id, 'approve')}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(doc.id, 'reject')}
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
                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No documents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
