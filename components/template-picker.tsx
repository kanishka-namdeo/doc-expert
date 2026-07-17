'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Trash2, Edit2, BookTemplate, Loader2 } from 'lucide-react';

interface Template {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  isSystem: boolean;
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (prompt: string) => void;
}

const CATEGORIES = ['summary', 'analysis', 'search', 'custom'] as const;

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  async function handleCreate() {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          prompt: newPrompt.trim(),
          category: newCategory,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates((prev) => [
          { ...created, isSystem: false },
          ...prev.filter((t) => !t.isSystem),
          ...prev.filter((t) => t.isSystem),
        ]);
        setCreateOpen(false);
        setNewTitle('');
        setNewPrompt('');
        setNewCategory('custom');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  const filteredTemplates = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.prompt.toLowerCase().includes(search.toLowerCase())
  );

  const systemTemplates = filteredTemplates.filter((t) => t.isSystem);
  const userTemplates = filteredTemplates.filter((t) => !t.isSystem);

  function groupByCategory(tpls: Template[]) {
    const groups: Record<string, Template[]> = {};
    for (const t of tpls) {
      const cat = t.category ?? 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookTemplate className="h-4 w-4" />
              Prompt Templates
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCreateOpen(true)}
              title="Create template"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading templates...
              </div>
            )}

            {!loading && userTemplates.length === 0 && systemTemplates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No templates found. Create one to get started.
              </div>
            )}

            {/* User Templates */}
            {userTemplates.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Your Templates
                </h3>
                <div className="space-y-2">
                  {Object.entries(groupByCategory(userTemplates)).map(([category, tpls]) => (
                    <div key={category}>
                      <div className="text-[10px] text-muted-foreground mb-1 capitalize">{category}</div>
                      {tpls.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            onSelect(t.prompt);
                            onOpenChange(false);
                          }}
                          className="w-full text-left p-3 rounded-md border bg-card hover:bg-accent transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{t.title}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(t.prompt);
                                }}
                                title="Copy prompt"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(t.id);
                                }}
                                disabled={deleting === t.id}
                                title="Delete template"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {t.prompt}
                          </p>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Defaults */}
            {systemTemplates.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  System Defaults
                </h3>
                <div className="space-y-2">
                  {Object.entries(groupByCategory(systemTemplates)).map(([category, tpls]) => (
                    <div key={category}>
                      <div className="text-[10px] text-muted-foreground mb-1 capitalize">{category}</div>
                      {tpls.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            onSelect(t.prompt);
                            onOpenChange(false);
                          }}
                          className="w-full text-left p-3 rounded-md border bg-card hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{t.title}</span>
                            <Badge variant="outline" className="text-[10px]">
                              System
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {t.prompt}
                          </p>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tpl-title">Title</Label>
              <Input
                id="tpl-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="My template"
              />
            </div>
            <div>
              <Label htmlFor="tpl-prompt">Prompt</Label>
              <textarea
                id="tpl-prompt"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Enter the prompt text..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div>
              <Label htmlFor="tpl-category">Category</Label>
              <select
                id="tpl-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim() || !newPrompt.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
