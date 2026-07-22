'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatHeader } from '@/components/chat-header';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { CitationPanel } from '@/components/citation-panel';
import { EmptyState } from '@/components/empty-state';
import { EnhancedCommandPalette } from '@/components/command-palette/enhanced-command-palette';
import { ContextualPreviewPopover } from '@/components/preview/contextual-preview-popover';
import { TemplatePicker } from '@/components/template-picker';
import { BookTemplate } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useLogger } from '@/hooks/use-logger';
import { ShareDialog } from '@/components/share-dialog';
import { FollowUpSuggestions } from '@/components/follow-up-suggestions';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { useOnboarding } from '@/hooks/use-onboarding';
import { ProgressChecklist } from '@/components/progress-checklist';
import { useProgressChecklist } from '@/hooks/use-progress-checklist';
import { useOnboardingHints } from '@/hooks/use-onboarding-hints';
import { PowerBar } from '@/components/power-bar/power-bar';
import type { SearchScope } from '@/components/command-palette/scope-filter';

export default function ChatPage() {
  const logger = useLogger('chat-page');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('doc-expert:model-preference') || '';
    }
    return '';
  });
  const [showUpload, setShowUpload] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    sourceId: string;
    title: string;
    filename: string;
    mediaType: string;
    excerpt?: string;
  } | null>(null);
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogConversationId, setShareDialogConversationId] = useState<string | null>(null);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [isConversationDrawerOpen, setIsConversationDrawerOpen] = useState(false);
  const { shouldShowWizard, isChecking, completeOnboarding, skipOnboarding } = useOnboarding();
  const { items, completedCount, totalCount, allComplete, isDismissed, dismiss } = useProgressChecklist();
  const { updateContext: updateHintContext } = useOnboardingHints();

  const transport = new DefaultChatTransport({
    api: '/api/chat',
    credentials: 'include',
    body: {
      model: selectedModel,
      conversationId: currentConversationId,
      collectionId: selectedCollectionId,
    },
  });

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
    onFinish: async ({ message }) => {
      if (currentConversationId) {
        try {
          await fetch(`/api/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: JSON.stringify(message.parts),
              metadata: message.metadata ? JSON.stringify(message.metadata) : null,
            }),
          });
        } catch (err) {
          logger.error('Failed to save assistant message', { err: err as unknown });
        }
      }

      const metadata = message.metadata as { conversationId?: string } | undefined;
      if (metadata?.conversationId && !currentConversationId) {
        setCurrentConversationId(metadata.conversationId);
      }

      // Parse follow-up suggestions from assistant message
      for (const part of message.parts) {
        if (part.type === 'text' && typeof part.text === 'string') {
          const suggestionsMatch = part.text.match(/SUGGESTIONS:\[(.*?)\]/);
          if (suggestionsMatch) {
            try {
              const suggestionsArray = JSON.parse(`[${suggestionsMatch[1]}]`) as string[];
              setSuggestions(prev => ({
                ...prev,
                [message.id]: suggestionsArray,
              }));
            } catch {
              // Failed to parse suggestions
            }
          }
        }
      }
    },
  });

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
          credentials: 'include',
        });

        if (!response.ok) {
          logger.error('Failed to load messages', { conversationId: currentConversationId, status: response.status });
          return;
        }

        const data = await response.json();
        const parsedMessages = data.messages.map((msg: unknown) => {
          if (typeof msg !== 'object' || msg === null) {
            throw new Error('Invalid message format');
          }
          const messageObj = msg as Record<string, unknown>;
          return {
            id: String(messageObj.id),
            role: String(messageObj.role),
            parts: typeof messageObj.content === 'string' ? JSON.parse(messageObj.content) : [],
            metadata: messageObj.metadata && typeof messageObj.metadata === 'string'
              ? JSON.parse(messageObj.metadata)
              : undefined,
          };
        });
        setMessages(parsedMessages);
      } catch (err) {
        logger.error('Failed to load messages', { err: err as unknown, conversationId: currentConversationId });
      }
    }

    loadMessages();
  }, [currentConversationId, setMessages]);

  // Check if user has documents for empty state
  useEffect(() => {
    async function checkDocuments() {
      try {
        const res = await fetch('/api/documents', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const docCount = data.documents?.length ?? 0;
          setHasDocuments(docCount > 0);
          updateHintContext({ hasDocuments: docCount > 0, documentCount: docCount });
        }
      } catch {
        setHasDocuments(false);
      }
    }
    checkDocuments();
  }, [updateHintContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    updateHintContext({
      messageCount: messages.length,
      hasCollection: !!selectedCollectionId,
      conversationMessageCount: messages.length,
    });
  }, [messages.length, selectedCollectionId, updateHintContext]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('doc-expert:model-preference', selectedModel);
      // Track recently used models for cycling
      try {
        const recentRaw = localStorage.getItem('doc-expert:recent-models');
        const recent = recentRaw ? JSON.parse(recentRaw) : [];
        const filtered = recent.filter((m: string) => m !== selectedModel);
        filtered.unshift(selectedModel);
        localStorage.setItem('doc-expert:recent-models', JSON.stringify(filtered.slice(0, 10)));
      } catch {
        // Ignore storage errors
      }
    }
  }, [selectedModel]);

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  const handleShareConversation = useCallback((conversationId: string) => {
    setShareDialogConversationId(conversationId);
    setShareDialogOpen(true);
  }, []);

  const handleOpenUpload = useCallback(() => {
    setShowUpload(true);
  }, []);

  const handleGoToDocuments = useCallback(() => {
    window.location.href = '/documents';
  }, []);

  const handleGoToCollections = useCallback(() => {
    window.location.href = '/collections';
  }, []);

  const handleCycleModel = useCallback(() => {
    // Cycle through available models — read from localStorage list of recently used models
    // or fall back to the model list from the API
    const usedModels = (() => {
      try {
        const stored = localStorage.getItem('doc-expert:recent-models');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    if (usedModels.length <= 1) return;

    const currentIndex = usedModels.indexOf(selectedModel);
    const nextIndex = (currentIndex + 1) % usedModels.length;
    setSelectedModel(usedModels[nextIndex]);
  }, [selectedModel, setSelectedModel]);

  const handleFocusCollectionFilter = useCallback(() => {
    // Focus the collection picker by dispatching a custom event that CollectionPicker listens for
    const selectEl = document.getElementById('collection-select');
    if (selectEl) {
      selectEl.focus();
      // Trigger the select dropdown by clicking it
      selectEl.click();
    }
  }, []);

  const handleCycleScope = useCallback(() => {
    // Dispatch a custom event that the command palette scope filter listens for
    const scopes: SearchScope[] = ['all', 'documents', 'collections', 'semantic'];
    const currentScope = (() => {
      try {
        const stored = localStorage.getItem('doc-expert:search-scope-chat');
        return (stored as SearchScope) || 'all';
      } catch {
        return 'all';
      }
    })();
    const currentIndex = scopes.indexOf(currentScope);
    const nextScope = scopes[(currentIndex + 1) % scopes.length];
    localStorage.setItem('doc-expert:search-scope-chat', nextScope);
    window.dispatchEvent(new CustomEvent('doc-expert:cycle-scope', { detail: nextScope }));
  }, []);

  useKeyboardShortcuts({
    onFocusInput: () => inputRef.current?.focus(),
    onNewConversation: handleNewConversation,
    onOpenUpload: handleOpenUpload,
    onStopStreaming: stop,
    onOpenSearch: () => setSearchOpen(true),
    onOpenTemplates: () => setTemplatePickerOpen(true),
    onOpenShortcutsHelp: () => setShortcutsDialogOpen(true),
    onGoToDocuments: handleGoToDocuments,
    onGoToCollections: handleGoToCollections,
    onCycleModel: handleCycleModel,
    onFocusCollectionFilter: handleFocusCollectionFilter,
    onCycleScope: handleCycleScope,
    inputRef: inputRef as React.RefObject<HTMLInputElement>,
  });

  return (
    <div className="flex h-screen">
      <Sheet open={isConversationDrawerOpen} onOpenChange={setIsConversationDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <ConversationSidebar
            currentConversationId={currentConversationId}
            setCurrentConversationId={setCurrentConversationId}
            selectedCollectionId={selectedCollectionId}
            setSelectedCollectionId={setSelectedCollectionId}
            onShare={handleShareConversation}
          />
        </SheetContent>
      </Sheet>
      <div className="flex flex-1 flex-col">
        <ChatHeader
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          showUpload={showUpload}
          setShowUpload={setShowUpload}
          currentConversationId={currentConversationId}
          setCurrentConversationId={setCurrentConversationId}
          selectedCollectionId={selectedCollectionId}
          setSelectedCollectionId={setSelectedCollectionId}
          onOpenShortcutsHelp={() => setShortcutsDialogOpen(true)}
          onOpenHistory={() => setIsConversationDrawerOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <PowerBar
            selectedCollectionId={selectedCollectionId}
            setSelectedCollectionId={setSelectedCollectionId}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            onSearchSelect={(query) => {
              setInput(query);
              inputRef.current?.focus();
            }}
          />
          {messages.length === 0 ? (
            <EmptyState
              hasDocuments={hasDocuments ?? false}
              onSuggestionClick={(text) => {
                setInput(text);
                inputRef.current?.focus();
              }}
              onUploadClick={() => setShowUpload(true)}
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
              {messages.map((m) => {
                const messageSuggestions = suggestions[m.id] || [];
                return (
                  <div key={m.id}>
                    <div
                      data-testid={m.role === 'user' ? 'user-message' : 'assistant-message'}
                      className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={
                          'max-w-[80%] rounded-lg px-4 py-2 ' +
                          (m.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted')
                        }
                      >
                        {m.parts?.map((part, i) => {
                          if (part.type === 'text') {
                            let text = part.text as string;

                            // Strip SUGGESTIONS:[...] from displayed text
                            text = text.replace(/SUGGESTIONS:\[.*?\]/, '').trim();

                            // Split text into segments and citation badges
                            const segments: { type: 'text' | 'citation'; content: string; num?: number }[] = [];
                            let lastIndex = 0;
                            const citationRegex = /\[(\d+)\]/g;
                            let match: RegExpExecArray | null;

                            while ((match = citationRegex.exec(text)) !== null) {
                              if (match.index > lastIndex) {
                                segments.push({
                                  type: 'text',
                                  content: text.slice(lastIndex, match.index),
                                });
                              }
                              segments.push({
                                type: 'citation',
                                content: match[0],
                                num: parseInt(match[1], 10),
                              });
                              lastIndex = match.index + match[0].length;
                            }
                            if (lastIndex < text.length) {
                              segments.push({
                                type: 'text',
                                content: text.slice(lastIndex),
                              });
                            }

                            return (
                              <div key={i}>
                                {segments.map((seg, j) => {
                                  if (seg.type === 'citation') {
                                    const sources = m.parts?.filter(
                                      (p) => p.type === 'source-document'
                                    ) || [];
                                    const sourcePart = sources[seg.num! - 1];
                                    const sourceId = sourcePart && typeof sourcePart === 'object'
                                      ? String((sourcePart as Record<string, unknown>).sourceId || '')
                                      : '';
                                    
                                    const badge = (
                                      <button
                                        key={j}
                                        onClick={() => {
                                          if (sourcePart && typeof sourcePart === 'object') {
                                            const sourceObj = sourcePart as Record<string, unknown>;
                                            const providerMeta = sourceObj.providerMetadata as Record<string, Record<string, unknown>> | undefined;
                                            const excerpt = providerMeta?.['doc-expert']?.excerpt as string | undefined;
                                            setSelectedSource({
                                              sourceId: String(sourceObj.sourceId || ''),
                                              title: String(sourceObj.title || ''),
                                              filename: String(sourceObj.filename || ''),
                                              mediaType: String(sourceObj.mediaType || ''),
                                              excerpt: excerpt || undefined,
                                            });
                                          }
                                        }}
                                        className="citation-badge inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary/20 text-primary rounded-full mx-0.5 cursor-pointer hover:bg-primary/30 transition-colors align-super"
                                        title={`Click to view source ${seg.num}`}
                                      >
                                        {seg.num}
                                      </button>
                                    );

                                    if (sourceId) {
                                      return (
                                        <ContextualPreviewPopover
                                          key={j}
                                          type="document"
                                          id={sourceId}
                                          side="top"
                                        >
                                          {badge}
                                        </ContextualPreviewPopover>
                                      );
                                    }
                                    return badge;
                                  }
                                  return (
                                    <ReactMarkdown
                                      key={j}
                                      remarkPlugins={[remarkGfm]}
                                    >
                                      {seg.content}
                                    </ReactMarkdown>
                                  );
                                })}
                              </div>
                            );
                          }

                          if (part.type === 'source-document') {
                            return (
                              <div key={i} className="mt-2 text-xs text-muted-foreground border-t pt-2">
                                <span className="font-medium">Source: </span>
                                <a
                                  href={`/documents/${part.sourceId}`}
                                  className="text-primary hover:underline"
                                >
                                  {part.title || part.filename || 'Document'}
                                </a>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>
                    {m.role === 'assistant' && messageSuggestions.length > 0 && (
                      <div className="ml-4">
                        <FollowUpSuggestions
                          suggestions={messageSuggestions}
                          onSelect={(text) => {
                            setInput(text);
                            inputRef.current?.focus();
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {error && (
                <div className="mx-auto max-w-3xl rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error.message}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || isStreaming) return;
            sendMessage({ text: input });
            setInput('');
          }}
          className="border-t p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isStreaming}
            />
            <Button type="submit" disabled={isStreaming || !input.trim()} size="sm">
              {isStreaming ? '...' : 'Send'}
            </Button>
            {isStreaming && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stop}
              >
                Stop
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setTemplatePickerOpen(true)}
              title="Templates (Ctrl+T)"
            >
              <BookTemplate className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
      <CitationPanel
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
      <EnhancedCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <ShareDialog
        conversationId={shareDialogConversationId || ''}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={(prompt) => {
          setInput(prompt);
          inputRef.current?.focus();
        }}
      />
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
      {!isChecking && (
        <OnboardingWizard
          open={shouldShowWizard}
          onClose={skipOnboarding}
          onComplete={completeOnboarding}
        />
      )}
      <ProgressChecklist
        items={items}
        completedCount={completedCount}
        totalCount={totalCount}
        allComplete={allComplete}
        isDismissed={isDismissed}
        onDismiss={dismiss}
      />
    </div>
  );
}
