'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '@/components/ui/button';
import { DocumentUpload } from '@/components/document-upload';

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <h1 className="text-xl font-semibold">Doc Expert</h1>
        <p className="text-sm text-muted-foreground">Enterprise Document Assistant</p>
      </header>

      <div className="border-b p-4">
        <div className="mx-auto max-w-3xl">
          <DocumentUpload />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Ask me anything about your documents.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
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
                    if (part.type !== 'text') return null;
                    
                    // Parse citation markers [1], [2], etc.
                    const textWithCitations = part.text.replace(
                      /\[(\d+)\]/g,
                      (match, num) => `<sup class="citation-badge">[${num}]</sup>`
                    );
                    
                    return (
                      <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          sup: ({ node, ...props }) => (
                            <sup
                              className="citation-badge inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary/20 text-primary rounded-full mx-0.5 cursor-help"
                              title={`Source ${props.children}`}
                              {...props}
                            />
                          ),
                        }}
                      >
                        {textWithCitations}
                      </ReactMarkdown>
                    );
                  })}
                </div>
              </div>
            ))}
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
        className="border-t p-4"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isStreaming}
          />
          <Button type="submit" disabled={isStreaming || !input.trim()}>
            {isStreaming ? '...' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}
