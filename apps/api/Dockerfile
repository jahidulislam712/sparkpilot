# syntax=docker/dockerfile:1

FROM node:24.15-alpine AS dependencies
WORKDIR /app
RUN npm install --global pnpm@12.6.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @sparkpilot/api...

FROM dependencies AS build
WORKDIR /app
COPY packages/config packages/config
COPY apps/api apps/api
RUN pnpm --filter @sparkpilot/api build && pnpm --filter @sparkpilot/api deploy --prod /app/deploy

FROM node:24.15-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S sparkpilot && adduser -S sparkpilot -G sparkpilot
COPY --from=build --chown=sparkpilot:sparkpilot /app/apps/api/dist ./dist
COPY --from=build --chown=sparkpilot:sparkpilot /app/deploy/node_modules ./node_modules
USER sparkpilot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
