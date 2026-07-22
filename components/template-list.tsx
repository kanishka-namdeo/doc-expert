'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TemplateEditor, type Template } from '@/components/template-editor';
import { Search, Plus, Pencil, Trash2, Loader2, BookTemplate } from 'lucide-react';

const CATEGORIES = ['all', 'summary', 'analysis', 'search', 'custom'] as const;

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      }
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleSave(data: { title: string; prompt: string; category: string }) {
    if (editingTemplate) {
      const res = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id ? { ...t, ...data } : t,
          ),
        );
      }
    } else {
      const res = await fetch('/api/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates((prev) => [{ ...created, isSystem: false }, ...prev]);
      }
    }
    setEditingTemplate(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  function openCreate() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function openEdit(template: Template) {
    setEditingTemplate(template);
    setEditorOpen(true);
  }

  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.prompt.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || (t.category ?? 'custom') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const systemTemplates = filtered.filter((t) => t.isSystem);
  const userTemplates = filtered.filter((t) => !t.isSystem);

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as string)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        )}

        {/* Empty state */}
        {!loading && userTemplates.length === 0 && !search && categoryFilter === 'all' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookTemplate className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No custom templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Save frequently asked questions as templates for quick access
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-3 w-3" />
              Create template
            </Button>
            {systemTemplates.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => document.getElementById('system-templates')?.scrollIntoView({ behavior: 'smooth' })}>
                Try a template
              </Button>
            )}
          </div>
        )}

        {/* No results from search/filter */}
        {!loading && filtered.length === 0 && (search || categoryFilter !== 'all') && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookTemplate className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No templates found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search or filter.
            </p>
          </div>
        )}

        {/* User Templates */}
        {!loading && userTemplates.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Templates
            </h3>
            <div className="grid gap-3">
              {userTemplates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{t.title}</span>
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                          {t.category ?? 'custom'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(t)}
                        title="Edit template"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(t.id)}
                        disabled={deletingId === t.id}
                        title="Delete template"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Templates */}
        {!loading && systemTemplates.length > 0 && (
          <div id="system-templates">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              System Defaults
            </h3>
            <div className="grid gap-3">
              {systemTemplates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{t.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          System
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {t.category ?? 'custom'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        onSave={handleSave}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this template? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deletingId === deleteConfirmId}
            >
              {deletingId === deleteConfirmId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
