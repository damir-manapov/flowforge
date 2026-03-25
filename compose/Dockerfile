FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile --filter @flowforge/server

COPY tsconfig.json ./
COPY apps/server/ apps/server/

RUN pnpm --filter @flowforge/server build

FROM node:24-alpine

RUN addgroup -S app && adduser -S app -G app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# Remove bundled npm/npx/yarn (unused — we use pnpm) to eliminate their transitive CVEs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
        /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
# Patch Alpine system packages to latest security fixes
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=builder --chown=app:app /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=builder --chown=app:app /app/apps/server/package.json apps/server/
COPY --from=builder --chown=app:app /app/apps/server/dist apps/server/dist
COPY --from=builder --chown=app:app /app/apps/server/data apps/server/data

# Install only production dependencies for the server
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @flowforge/server \
  && rm -rf /root/.cache/node /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx

ENV NODE_ENV=production
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/main.js"]
