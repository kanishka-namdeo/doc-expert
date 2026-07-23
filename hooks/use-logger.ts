'use client';

import { useCallback, useMemo } from 'react';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  url?: string;
}

const MAX_LOGS = 100;
let clientLogs: LogEntry[] = [];

export function getClientLogs(): LogEntry[] {
  return [...clientLogs];
}

export function clearClientLogs() {
  clientLogs = [];
}

export function useLogger(module: string) {
  const log = useCallback((level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      url: window.location.href,
    };
    
    // Keep in memory (capped)
    clientLogs.push(entry);
    if (clientLogs.length > MAX_LOGS) {
      clientLogs = clientLogs.slice(-MAX_LOGS);
    }
    
    // Also send to server for persistent storage
    navigator.sendBeacon('/api/logs/client', JSON.stringify(entry));
    
    // Console fallback for dev
    if (process.env.NODE_ENV === 'development') {
      console[level](`[${module}] ${message}`, context);
    }
  }, [module]);

  return useMemo(() => ({
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  }), [log]);
}
