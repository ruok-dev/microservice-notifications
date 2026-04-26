# ── Stage 1: deps ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Install only production deps
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: production image ─────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only what's needed
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY scripts ./scripts
COPY docs ./docs
COPY package.json ./

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Expose port (no EXPOSE exposes nothing to host by default)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/ping || exit 1

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
