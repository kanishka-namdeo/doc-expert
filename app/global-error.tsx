'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to audit system
    console.error('Global error:', error);
    
    // Could also send to error tracking service here
    // e.g., Sentry, LogRocket, etc.
  }, [error]);

  const getErrorMessage = () => {
    if (error.message.includes('Failed to parse document')) {
      return 'Document parsing failed. Please try a different file format.';
    }
    if (error.message.includes('LLM') || error.message.includes('model')) {
      return 'AI service temporarily unavailable. Please try again in a moment.';
    }
    if (error.message.includes('Qdrant') || error.message.includes('database')) {
      return 'Database connection issue. Please contact support if this persists.';
    }
    return 'Something went wrong. Please try again.';
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{getErrorMessage()}</p>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
