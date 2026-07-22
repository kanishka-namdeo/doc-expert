'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Keyboard, Search, Star } from 'lucide-react';

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; description: string; powerUser?: boolean }[];
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Escape'], description: 'Stop streaming / Close dialogs' },
    ],
  },
  {
    label: 'Chat',
    shortcuts: [
      { keys: [mod, 'K'], description: 'Focus input / Open search' },
      { keys: [mod, 'Shift', 'K'], description: 'Open search dialog' },
      { keys: [mod, 'Shift', 'N'], description: 'New conversation' },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { keys: [mod, 'G'], description: 'Go to documents', powerUser: true },
      { keys: [mod, 'Shift', 'C'], description: 'Go to collections', powerUser: true },
    ],
  },
  {
    label: 'Documents & Templates',
    shortcuts: [
      { keys: [mod, 'T'], description: 'Open template picker' },
      { keys: [mod, 'U'], description: 'Open upload dialog' },
    ],
  },
  {
    label: 'Pinning',
    shortcuts: [
      { keys: [mod, 'Shift', 'P'], description: 'Pin / Unpin selected item', powerUser: true },
      { keys: [mod, '1–9'], description: 'Open Nth pinned item', powerUser: true },
    ],
  },
  {
    label: 'Search',
    shortcuts: [
      { keys: [mod, 'S'], description: 'Save current search', powerUser: true },
      { keys: [mod, '/'], description: 'Cycle search scope', powerUser: true },
    ],
  },
  {
    label: 'Bulk Actions',
    shortcuts: [
      { keys: [mod, 'A'], description: 'Select all visible items', powerUser: true },
      { keys: [mod, 'Shift', 'A'], description: 'Add selected to collection', powerUser: true },
    ],
  },
  {
    label: 'Context',
    shortcuts: [
      { keys: [mod, 'M'], description: 'Cycle through recent models', powerUser: true },
      { keys: [mod, 'Shift', 'F'], description: 'Focus collection filter', powerUser: true },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const [filter, setFilter] = useState('');

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.filter(
      (s) =>
        filter.length === 0 ||
        s.description.toLowerCase().includes(filter.toLowerCase()) ||
        s.keys.some((k) => k.toLowerCase().includes(filter.toLowerCase()))
    ),
  })).filter((group) => group.shortcuts.length > 0);

  const powerUserCount = SHORTCUT_GROUPS.flatMap((g) => g.shortcuts).filter((s) => s.powerUser).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>
            Quick reference for all available keyboard shortcuts.
            {powerUserCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <Star className="h-3 w-3 fill-yellow-400" />
                {powerUserCount} power user shortcuts
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter shortcuts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
            aria-label="Filter shortcuts"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{shortcut.description}</span>
                      {shortcut.powerUser && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-0.5">
                          {i > 0 && <span className="text-muted-foreground">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No shortcuts match &quot;{filter}&quot;
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
