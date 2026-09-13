# ---- Backend build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ---- Production image ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# --ignore-scripts: postinstall (prisma generate) must not run here — the
# prisma schema isn't copied yet and the client is already copied below.
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Invoice PDF storage. The container filesystem is ephemeral — mount a
# persistent volume here (or point INVOICES_DIR at a volume path).
RUN mkdir -p /app/storage/invoices

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]