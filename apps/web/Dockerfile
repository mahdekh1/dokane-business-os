# syntax=docker/dockerfile:1
# Web image (Next.js). Build context = repo root (see docker-compose.prod.yml).
# NEXT_PUBLIC_* is inlined at BUILD time, so NEXT_PUBLIC_API_URL is a build arg.
# Default "/api/v1" keeps the browser same-origin (Caddy proxies /api/* to the API).

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build \
 && pnpm --filter @dokane/web build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
