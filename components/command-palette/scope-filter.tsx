'use client';

import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen, Sparkles, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchScope = 'all' | 'documents' | 'collections' | 'semantic';

interface ScopeFilterProps {
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
}

const SCOPES: { value: SearchScope; label: string; icon: typeof FileText }[] = [
  { value: 'all', label: 'All', icon: Globe },
  { value: 'documents', label: 'Docs', icon: FileText },
  { value: 'collections', label: 'Collections', icon: FolderOpen },
  { value: 'semantic', label: 'Semantic', icon: Sparkles },
];

export function ScopeFilter({ scope, onScopeChange }: ScopeFilterProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, value: SearchScope) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onScopeChange(value);
    }
  }, [onScopeChange]);

  // Listen for scope cycle events from keyboard shortcut
  useEffect(() => {
    function handleCycleScope(event: Event) {
      const customEvent = event as CustomEvent<SearchScope>;
      if (customEvent.detail) {
        onScopeChange(customEvent.detail);
      }
    }

    window.addEventListener('doc-expert:cycle-scope', handleCycleScope as EventListener);
    return () => window.removeEventListener('doc-expert:cycle-scope', handleCycleScope as EventListener);
  }, [onScopeChange]);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b" role="group" aria-label="Search scope">
      {SCOPES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant="ghost"
          size="sm"
          role="tab"
          aria-selected={scope === value}
          className={cn(
            'h-7 px-2 text-xs gap-1',
            scope === value && 'bg-secondary text-secondary-foreground'
          )}
          onClick={() => onScopeChange(value)}
          onKeyDown={(e) => handleKeyDown(e, value)}
        >
          <Icon className="h-3 w-3" />
          {label}
        </Button>
      ))}
    </div>
  );
}
