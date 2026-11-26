# syntax=docker/dockerfile:1

FROM node:24.15-alpine AS base
RUN npm install --global pnpm@12.6.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @sparkpilot/web...

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config packages/config
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @sparkpilot/web build

FROM node:24.15-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk upgrade --no-cache \
  && addgroup -S sparkpilot \
  && adduser -S sparkpilot -G sparkpilot \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -rf /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=build --chown=sparkpilot:sparkpilot /app/apps/web/.next/standalone ./
COPY --from=build --chown=sparkpilot:sparkpilot /app/apps/web/.next/static ./apps/web/.next/static
USER sparkpilot
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
