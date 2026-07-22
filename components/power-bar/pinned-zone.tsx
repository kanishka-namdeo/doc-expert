'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FolderOpen, BookTemplate, Search, GripVertical, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePinning } from '@/hooks/use-pinning';
import { useLogger } from '@/hooks/use-logger';
import type { PinnedItem } from '@/lib/types/pinning';

interface PinnedZoneProps {
  collapsed: boolean;
}

const typeIcons: Record<PinnedItem['type'], React.ComponentType<{ className?: string }>> = {
  document: FileText,
  collection: FolderOpen,
  template: BookTemplate,
  'saved-search': Search,
};

const typeRoutes: Record<PinnedItem['type'], (id: string) => string> = {
  document: (id) => `/documents/${id}`,
  collection: (id) => `/collections/${id}`,
  template: () => '',
  'saved-search': () => '',
};

export const PinnedZone = memo(function PinnedZone({ collapsed }: PinnedZoneProps) {
  const router = useRouter();
  const logger = useLogger('pinned-zone');
  const { pinnedItems, unpin, reorder } = usePinning();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLButtonElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLButtonElement;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image semi-transparent
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorder(dragIndex, dragOverIndex);
      logger.info('Pinned item reordered', { from: dragIndex, to: dragOverIndex });
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, dragOverIndex, reorder, logger]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleClick = useCallback((item: PinnedItem) => {
    const route = typeRoutes[item.type](item.id);
    if (route) {
      router.push(route);
    } else if (item.type === 'template') {
      logger.info('Template pin clicked', { id: item.id });
    } else if (item.type === 'saved-search') {
      logger.info('Saved search pin clicked', { id: item.id });
    }
  }, [router, logger]);

  if (pinnedItems.length === 0) {
    return null;
  }

  const displayItems = collapsed ? pinnedItems.slice(0, 3) : pinnedItems;

  return (
    <div className="flex items-center gap-1" role="region" aria-label="Pinned items">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {pinnedItems.length} pinned items
      </div>
      {!collapsed && (
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">Pinned:</span>
      )}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {displayItems.map((item, index) => {
          const Icon = typeIcons[item.type];
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          const chip = (
            <button
              key={`${item.type}-${item.id}`}
              draggable={!collapsed}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onClick={() => handleClick(item)}
              className={[
                'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                'bg-background border hover:bg-accent transition-colors shrink-0',
                isDragOver ? 'ring-2 ring-primary ring-offset-1' : '',
                collapsed ? 'px-1.5' : '',
              ].join(' ')}
              aria-label={`Pinned ${item.type}: ${item.title}`}
            >
              {!collapsed && (
                <GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
              )}
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              {!collapsed && (
                <span className="truncate max-w-[120px]">{item.title}</span>
              )}
              {!collapsed && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    unpin(item.id, item.type);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      unpin(item.id, item.type);
                    }
                  }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all cursor-pointer"
                  aria-label={`Unpin ${item.title}`}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={`${item.type}-${item.id}`}>
                <TooltipTrigger>{chip}</TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{item.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return chip;
        })}
      </div>
    </div>
  );
});

PinnedZone.displayName = 'PinnedZone';
