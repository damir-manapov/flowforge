FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

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

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/packages/test-utils/package.json packages/test-utils/
COPY --from=builder /app/packages/test-utils/dist packages/test-utils/dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules

EXPOSE 3000

CMD ["node", "apps/server/dist/server.js"]
