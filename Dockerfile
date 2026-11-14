FROM node:26.13.1-alpine AS base
WORKDIR /app

FROM base AS pnpm
ARG PNPM_VERSION=12.18.0
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY web/package.json web/

FROM pnpm AS deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile

FROM pnpm AS backend-prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter backend...

FROM deps AS build-backend
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
RUN pnpm --filter shared build && pnpm --filter backend build

FROM deps AS build-web
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY web/ web/
RUN pnpm --filter web build --configuration production

# --- Backend runtime ---
FROM base AS backend
ENV NODE_ENV=production
COPY --from=backend-prod-deps /app/node_modules ./node_modules
COPY --from=backend-prod-deps /app/backend/node_modules ./backend/node_modules
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY --from=build-backend /app/shared/dist ./shared/dist
COPY --from=build-backend /app/backend/dist ./backend/dist
EXPOSE 3000
USER node
CMD ["node", "backend/dist/index.js"]

# --- Frontend runtime ---
FROM base AS frontend
ENV NODE_ENV=production
COPY --from=build-web /app/web/dist ./web/dist
EXPOSE 4000
ENV PORT=4000
USER node
CMD ["node", "web/dist/release-manager/server/server.mjs"]
