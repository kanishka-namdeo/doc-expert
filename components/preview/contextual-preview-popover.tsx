'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DocumentPreviewContent } from './document-preview-content';
import { CollectionPreviewContent } from './collection-preview-content';

interface ContextualPreviewPopoverProps {
  children: React.ReactNode;
  type: 'document' | 'collection';
  id: string;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

export function ContextualPreviewPopover({
  children,
  type,
  id,
  side = 'right',
}: ContextualPreviewPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (pinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(true);
      dismissTimeoutRef.current = setTimeout(() => {
        if (!pinned) {
          setOpen(false);
        }
      }, 5000);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    if (!pinned) {
      setOpen(false);
    }
  };

  const handleClick = () => {
    setPinned(!pinned);
    setOpen(!pinned);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setPinned(false);
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side={side} className="w-64">
        {type === 'document' ? (
          <DocumentPreviewContent documentId={id} />
        ) : (
          <CollectionPreviewContent collectionId={id} />
        )}
      </PopoverContent>
    </Popover>
  );
}
