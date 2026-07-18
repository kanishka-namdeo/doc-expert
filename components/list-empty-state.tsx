import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ListEmptyStateProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ListEmptyState({ message, description, icon, action }: ListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3">{icon}</div>}
      <h3 className="text-sm font-medium">{message}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ListLoadingStateProps {
  message?: string;
}

export function ListLoadingState({ message = 'Loading...' }: ListLoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

interface ListErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export function ListErrorState({ error, onRetry }: ListErrorStateProps) {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      {error}
      {onRetry && (
        <Button variant="link" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
