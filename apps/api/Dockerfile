FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci
COPY prisma prisma
RUN npm run db:generate
COPY apps/api apps/api
RUN npm run build -w apps/api
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace apps/api --include-workspace-root
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
