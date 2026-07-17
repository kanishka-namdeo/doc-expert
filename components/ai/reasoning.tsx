'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReasoningProps {
  children: React.ReactNode;
}

export function Reasoning({ children }: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 rounded-md border border-dashed p-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
      >
        <span>Reasoning</span>
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>

      {isOpen && (
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
