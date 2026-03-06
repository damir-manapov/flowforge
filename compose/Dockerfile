FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/test-utils/package.json packages/test-utils/

RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.check.json ./
COPY packages/test-utils/ packages/test-utils/
COPY apps/server/ apps/server/

RUN pnpm build

FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

WORKDIR /app

COPY --from=builder --chown=app:app /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder --chown=app:app /app/apps/server/package.json apps/server/
COPY --from=builder --chown=app:app /app/apps/server/dist apps/server/dist

# Install only production dependencies for the server
RUN pnpm install --frozen-lockfile --prod --filter @flowforge/server

ENV NODE_ENV=production
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/main.js"]
