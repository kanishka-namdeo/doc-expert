'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLogger } from '@/hooks/use-logger';

interface DocumentItem {
  id: string;
  fileName: string;
  mediaType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface DocumentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (documentIds: string[]) => void;
  excludeIds?: string[];
  loading?: boolean;
}

export function DocumentPicker({ open, onOpenChange, onSelect, excludeIds = [], loading: externalLoading }: DocumentPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const logger = useLogger('document-picker');

  const excludeSet = new Set(excludeIds);

  const fetchDocuments = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/documents?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      logger.error('Failed to fetch documents', { err });
    } finally {
      setLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedIds(new Set());
      fetchDocuments('');
    }
  }, [open, fetchDocuments]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        fetchDocuments(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, open, fetchDocuments]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds));
    onOpenChange(false);
  };

  const filteredDocs = documents.filter((d) => !excludeSet.has(d.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Documents</DialogTitle>
          <DialogDescription>
            Search and select documents to add to this collection.
          </DialogDescription>
        </DialogHeader>

        <div className="relative py-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
          {loading || externalLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">No documents found</p>
            </div>
          ) : (
            <ul className="divide-y">
              {filteredDocs.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <li
                    key={doc.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors ${
                      isSelected ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => toggleSelect(doc.id)}
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/50'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {doc.mediaType}
                        </span>
                        {doc.status && doc.status !== 'approved' && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {doc.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Add {selectedIds.size > 0 ? `${selectedIds.size} Document${selectedIds.size !== 1 ? 's' : ''}` : 'Documents'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
