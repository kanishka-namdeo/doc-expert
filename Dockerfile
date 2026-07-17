# Stage 1: Dependencies
FROM node:22-slim AS deps
WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm install --frozen-lockfile --prod=false --config.minimumReleaseAge=0

# Stage 2: Builder
FROM node:22-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
ENV CI=true
RUN mkdir -p /app/data && \
    corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm run build

# Stage 3: Runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership to non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
