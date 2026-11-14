# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0

# ── dependencies (including dev, for the build) ─────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts/prepare-husky.mjs ./scripts/prepare-husky.mjs
RUN npm ci --no-audit --no-fund

# ── production dependencies only ────────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY scripts/prepare-husky.mjs ./scripts/prepare-husky.mjs
RUN npm ci --omit=dev --no-audit --no-fund

# ── build ───────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time by Next.js.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
# The other placeholders only need to exist for the build.
ENV NEXT_OUTPUT=standalone \
    DATABASE_URL=postgres://dua:dua@localhost:5432/dua \
    ADMIN_PASSWORD=build-placeholder \
    SUBMISSION_EDIT_SECRET=build-placeholder-not-used-at-runtime \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
