# ==============================================================================
# ShopSync — Production Dockerfile
# ==============================================================================
# Multi-stage container build for ShopSync (Next.js + node:sqlite WAL database)
# Base Image: Node.js 22 LTS (Active LTS with native node:sqlite support)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies & Builder
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install exact dependencies
RUN npm ci

# Copy source code and configuration
COPY tsconfig.json next.config.js ./
COPY public ./public
COPY src ./src

# Build optimized Next.js production bundle
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for health check probe
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -r shopsync && useradd -r -g shopsync -m shopsync

# Create data directory with proper ownership for persistent SQLite database
RUN mkdir -p /app/data /app/data/backups && chown -R shopsync:shopsync /app/data

# Copy built artifacts and production dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
COPY server.js ./server.js
COPY scripts ./scripts

# Set permissions
RUN chown -R shopsync:shopsync /app

USER shopsync

# Expose internal HTTP port
EXPOSE 3000

# Declare persistent volume mount point for SQLite database and live backups
VOLUME ["/app/data"]

# Automated Health Check Probe using /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start Next.js production server
CMD ["npm", "run", "start", "--", "-p", "3000"]
