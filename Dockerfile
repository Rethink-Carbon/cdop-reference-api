# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/cdop-schemas/package.json packages/cdop-schemas/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/cdop-schemas packages/cdop-schemas
COPY apps/api apps/api
COPY supabase supabase
# Only the HAL Explorer download is optional; a failed TypeScript build must fail the image.
RUN pnpm --filter @cdop/schemas build && pnpm --filter @cdop/api build \
 && (node apps/api/scripts/fetch-explorer.mjs || true)
RUN pnpm --filter @cdop/api deploy --prod --legacy /out/api \
 && cp -r supabase /out/api/supabase \
 && cp -r apps/api/openapi /out/api/openapi \
 && cp -r apps/api/public /out/api/public \
 && cp -r apps/api/schemas /out/api/schemas

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /out/api /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
