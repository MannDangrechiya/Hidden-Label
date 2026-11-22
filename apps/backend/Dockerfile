# =============================================================================
# THE HIDDEN LABEL — Backend (Medusa 2.22.7) Production Dockerfile
# =============================================================================

FROM node:22.22.0-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
RUN npm install -g pnpm@10.32.1

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=dependencies /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=dependencies /app/packages/ui/node_modules ./packages/ui/node_modules
COPY . .
RUN pnpm --filter @thl/shared build 2>/dev/null || pnpm --filter @thl/shared typecheck
RUN pnpm --filter @thl/backend build

FROM node:22.22.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 medusa
RUN npm install -g pnpm@10.32.1

COPY --from=dependencies /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=builder /app/apps/backend ./apps/backend

USER medusa
EXPOSE 9000
WORKDIR /app/apps/backend
CMD ["pnpm", "start"]
