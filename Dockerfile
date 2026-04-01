FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY web/package.json web/
RUN npm ci

FROM base AS build-backend
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY shared/ shared/
RUN cd shared && npx tsc --build --force tsconfig.json && ls dist/
RUN rm -rf node_modules/shared && ln -s /app/shared node_modules/shared
COPY backend/ backend/
RUN cd backend && npx tsc -p tsconfig.json

FROM base AS build-web
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY shared/ shared/
RUN cd shared && npx tsc --build --force tsconfig.json && ls dist/
RUN rm -rf node_modules/shared && ln -s /app/shared node_modules/shared
COPY web/ web/
RUN cd web && npx ng build --configuration production

# --- Backend runtime ---
FROM base AS backend
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-backend /app/shared ./node_modules/shared
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY backend/package.json backend/
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]

# --- Frontend runtime ---
FROM base AS frontend
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-web /app/shared ./node_modules/shared
COPY --from=build-web /app/web/dist ./web/dist
EXPOSE 4000
ENV PORT=4000
CMD ["node", "web/dist/movie-releases/server/server.mjs"]
