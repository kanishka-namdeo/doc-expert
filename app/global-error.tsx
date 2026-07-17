'use client';

import { useEffect } from 'react';
import { useLogger } from '@/hooks/use-logger';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const logger = useLogger('global-error');

  useEffect(() => {
    logger.error('Global error boundary caught', { err: error.message, digest: error.digest });
  }, [error, logger]);

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
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <CardTitle className="text-destructive">Critical Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{getErrorMessage()}</p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/70 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
