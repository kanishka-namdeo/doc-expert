'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ChecklistItem } from '@/hooks/use-progress-checklist';

interface ProgressChecklistProps {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  isDismissed: boolean;
  onDismiss: () => void;
}

export function ProgressChecklist({
  items,
  completedCount,
  totalCount,
  allComplete,
  isDismissed,
  onDismiss,
}: ProgressChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    function handleClickOutside(event: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  if (allComplete || isDismissed) {
    return null;
  }

  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div
      ref={widgetRef}
      className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-background shadow-lg"
    >
      {isExpanded ? (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Getting Started</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDismiss}
              aria-label="Dismiss checklist"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{completedCount}/{totalCount} complete</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    item.completed
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  )}
                >
                  {item.completed && <Check className="h-3 w-3" />}
                </div>
                <span
                  className={cn(
                    'text-sm',
                    item.completed ? 'text-muted-foreground line-through' : ''
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp className="mr-1 h-4 w-4 rotate-180" />
            Collapse
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Getting Started</span>
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
