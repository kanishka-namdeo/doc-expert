import pino from 'pino';

// Build transports array based on environment (server-side only)
const transports: Array<{ target: string; options?: Record<string, unknown> }> = [];

// Always log to stdout (captured by Next.js process)
transports.push({
  target: 'pino/file',
  options: { destination: 1 }, // fd 1 = stdout
});

// Add pretty-printing in development
if (process.env.NODE_ENV === 'development') {
  transports.push({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  });
}

// Add file transport if LOG_FILE is set (production persistent capture)
if (process.env.LOG_FILE && process.env.NODE_ENV !== 'development') {
  transports.push({
    target: 'pino/file',
    options: { 
      destination: process.env.LOG_FILE,
      mkdir: true, // create parent directories if needed
    },
  });
}

// Detect Edge Runtime (used by middleware) - no worker threads available
const isEdgeRuntime = typeof globalThis === 'object' && globalThis !== null && 'EdgeRuntime' in globalThis;

// Detect browser/client environment
const isBrowser = typeof window !== 'undefined';

let baseLogger: pino.Logger;

const redactPaths = [
  'password', 'token', 'secret', 'apiKey', 'api_key',
  'authorization', 'cookie', 'credentials', 'refreshToken',
  'req.body.password', 'req.body.token', 'req.body.secret',
  'req.headers.authorization', 'req.headers.cookie',
];

if (isBrowser) {
  // Browser-safe logger using console transport
  baseLogger = pino({
    level: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: redactPaths, censor: '[Redacted]' },
    browser: {
      asObject: true,
      transmit: {
        send() {}, // No-op for client-side
      },
    },
  });
} else if (isEdgeRuntime) {
  // Simple stdout logger for Edge Runtime
  baseLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: redactPaths, censor: '[Redacted]' },
  });
} else {
  // Full multi-transport logger for Node.js runtime
  const transport = pino.transport({ targets: transports });
  baseLogger = pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: redactPaths, censor: '[Redacted]' },
    },
    transport
  );
}

export function createRequestLogger() {
  const requestId = crypto.randomUUID();
  return baseLogger.child({ requestId });
}

export function getLogger(module: string) {
  return baseLogger.child({ module });
}

export type Logger = ReturnType<typeof getLogger>;
