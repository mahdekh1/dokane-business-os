# syntax=docker/dockerfile:1
# API image (NestJS). Build context = repo root (see docker-compose.prod.yml).

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- builder: install everything, build workspace packages + the API ----
FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "./packages/*" build \
 && pnpm --filter @dokane/api build

# ---- runner: copy the built workspace, run migrations then start ----
FROM base AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=builder /app /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
