'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DocumentUpload } from '@/components/document-upload';
import { Upload, MessageSquare, Compass, Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Upload', icon: Upload },
  { id: 2, title: 'Ask', icon: MessageSquare },
  { id: 3, title: 'Explore', icon: Compass },
] as const;

export function OnboardingWizard({ open, onClose, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [hasDocument, setHasDocument] = useState(false);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (!open) {
      setStep(1);
      setHasDocument(false);
      setQuestion('');
    }
  }, [open]);

  useEffect(() => {
    if (step !== 1 || !open) return;

    let cancelled = false;

    async function checkDocuments() {
      try {
        const res = await fetch('/api/documents', { credentials: 'include' });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { documents?: unknown[] };
          setHasDocument((data.documents?.length ?? 0) > 0);
        }
      } catch {
        // ignore
      }
    }

    checkDocuments();
    const interval = setInterval(checkDocuments, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, open]);

  const handleNext = useCallback(() => {
    if (step < 3) setStep(step + 1);
  }, [step]);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = s.id === step;
                const isComplete = s.id < step;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                        isActive && 'bg-primary text-primary-foreground',
                        isComplete && 'bg-primary/20 text-primary',
                        !isActive && !isComplete && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                      <span>{s.title}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cn(
                          'h-px w-4',
                          s.id < step ? 'bg-primary/40' : 'bg-border'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              Step {step} of 3
            </span>
          </div>
          <DialogTitle>
            {step === 1 && 'Upload your first document'}
            {step === 2 && 'Ask a question'}
            {step === 3 && 'You\'re all set!'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Start by uploading a PDF, DOCX, or Markdown file to chat with.'}
            {step === 2 && 'Now ask a question about your document to get AI-powered answers with citations.'}
            {step === 3 && 'Great job! You\'ve completed the basics. Here are some next steps to explore.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {step === 1 && (
            <div className="space-y-4">
              <DocumentUpload />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose}>
                  Skip
                </Button>
                <Button onClick={handleNext} disabled={!hasDocument}>
                  Next
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Try asking:
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What is this document about?"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You can type your own question or use the suggestion above. The AI will search your document and provide answers with source citations.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose}>
                    Skip
                  </Button>
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-primary/5 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                  <Compass className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-1 text-sm font-medium">Ready to explore</h3>
                <p className="text-xs text-muted-foreground">
                  You now know the basics. Here are some things you can do next:
                </p>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span>Create a <strong>collection</strong> to group related documents</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span>Use <strong>scoped search</strong> to ask questions within a collection</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span><strong>Share</strong> conversations with your team</span>
                </li>
              </ul>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={handleComplete}>
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
