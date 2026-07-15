'use client';

import { useState, useEffect } from 'react';
import type { UIMessage } from 'ai';

const MAX_MESSAGES = 10;

export function useConversation(conversationId: string = 'default') {
  const storageKey = `conversation-${conversationId}`;
  
  const [messages, setMessages] = useState<UIMessage[]>([]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UIMessage[];
        setMessages(parsed.slice(-MAX_MESSAGES));
      } catch {
        // Invalid JSON, start fresh
        setMessages([]);
      }
    }
  }, [storageKey]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      const toStore = messages.slice(-MAX_MESSAGES);
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    }
  }, [messages, storageKey]);

  const addMessage = (message: UIMessage) => {
    setMessages(prev => {
      const updated = [...prev, message].slice(-MAX_MESSAGES);
      return updated;
    });
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  };

  return {
    messages,
    setMessages,
    addMessage,
    clearHistory,
  };
}
