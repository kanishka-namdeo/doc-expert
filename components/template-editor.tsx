'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface Template {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  isSystem: boolean;
}

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  onSave: (data: { title: string; prompt: string; category: string }) => Promise<void>;
}

const CATEGORIES = ['summary', 'analysis', 'search', 'custom'] as const;

export function TemplateEditor({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateEditorProps) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('custom');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setTitle(template.title);
        setPrompt(template.prompt);
        setCategory(template.category ?? 'custom');
      } else {
        setTitle('');
        setPrompt('');
        setCategory('custom');
      }
    }
  }, [open, template]);

  async function handleSubmit() {
    if (!title.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        prompt: prompt.trim(),
        category,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!template && !template.isSystem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Template' : 'Create Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-title">Title</Label>
            <Input
              id="template-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My template"
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="template-prompt">Prompt</Label>
            <Textarea
              id="template-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt text..."
              rows={4}
              disabled={saving}
            />
          </div>
          <div>
            <Label htmlFor="template-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as string)} disabled={saving}>
              <SelectTrigger id="template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !prompt.trim()}
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
