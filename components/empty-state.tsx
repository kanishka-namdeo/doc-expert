'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare, Upload, FileText, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  hasDocuments: boolean;
  onSuggestionClick: (text: string) => void;
  onUploadClick: () => void;
}

const SUGGESTIONS = [
  'Summarize my documents',
  'What are the key points?',
  'Find information about contracts',
  'Compare the two documents',
];

export function EmptyState({ hasDocuments, onSuggestionClick, onUploadClick }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">Start a conversation</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Upload a document and ask questions to get AI-powered answers with citations
      </p>

      {!hasDocuments && (
        <div className="mb-8 rounded-lg border border-dashed p-6 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No documents uploaded yet</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Upload a document to get started with AI-powered Q&A
          </p>
          <Button onClick={onUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload your first document
          </Button>
        </div>
      )}

      <div className="w-full max-w-md">
        <p className="mb-3 text-xs font-medium text-muted-foreground tracking-wider">
          Suggested prompts
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
