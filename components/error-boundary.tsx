'use client';

import React, { Component, type ReactNode } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.logError(error, errorInfo);
  }

  private logError(error: Error, errorInfo: React.ErrorInfo) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      context: {
        componentStack: errorInfo.componentStack,
        name: error.name,
        url: window.location.href,
      },
    };

    // Persist to client log buffer
    try {
      const stored = localStorage.getItem('doc-expert-client-logs');
      const logs: unknown[] = stored ? JSON.parse(stored) : [];
      logs.push(entry);
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      localStorage.setItem('doc-expert-client-logs', JSON.stringify(logs));
    } catch {
      // localStorage may be full or unavailable
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error.message, { componentStack: errorInfo.componentStack });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                <CardTitle className="text-destructive">Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {this.getErrorMessage()}
              </p>
              {this.state.error && (
                <p className="mt-2 text-xs text-muted-foreground/70 font-mono truncate">
                  {this.state.error.message}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }

  private getErrorMessage(): string {
    const msg = this.state.error?.message ?? '';
    if (msg.includes('Failed to parse document')) {
      return 'Document parsing failed. Please try a different file format.';
    }
    if (msg.includes('LLM') || msg.includes('model')) {
      return 'AI service temporarily unavailable. Please try again in a moment.';
    }
    if (msg.includes('Qdrant') || msg.includes('database')) {
      return 'Database connection issue. Please contact support if this persists.';
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
