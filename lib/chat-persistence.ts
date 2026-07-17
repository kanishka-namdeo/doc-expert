// Conversation persistence helpers using localStorage
// Guards typeof window and wraps in try/catch for safety

import { MyUIMessage } from '@/lib/types';

const MESSAGES_KEY = 'doc-expert-messages';
const INPUT_KEY = 'doc-expert-input';
const MODEL_KEY = 'doc-expert-model';

export function saveMessages(messages: MyUIMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // Silently fail if localStorage is unavailable (e.g., private mode)
  }
}

export function loadMessages(): MyUIMessage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MESSAGES_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveInput(input: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INPUT_KEY, input);
  } catch {
    // Silently fail
  }
}

export function loadInput(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(INPUT_KEY);
  } catch {
    return null;
  }
}

export function saveModel(model: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    // Silently fail
  }
}

export function loadModel(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MODEL_KEY);
  } catch {
    return null;
  }
}
