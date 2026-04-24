FROM node:20-alpine3.19 AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY client/package.json client/

FROM base AS deps
RUN npm install

FROM deps AS build
COPY . .
RUN npx prisma generate --schema=server/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine3.19 AS production
RUN apk add --no-cache openssl && \
    addgroup -g 1001 -S appuser && adduser -S appuser -u 1001 -G appuser
WORKDIR /app
COPY --chown=appuser:appuser --from=build /app/node_modules ./node_modules
COPY --chown=appuser:appuser --from=build /app/server/node_modules ./server/node_modules
COPY --chown=appuser:appuser --from=build /app/server/dist ./server/dist
COPY --chown=appuser:appuser --from=build /app/server/prisma ./server/prisma
COPY --chown=appuser:appuser --from=build /app/client/dist ./client/dist
COPY --chown=appuser:appuser --from=build /app/server/package.json ./server/
COPY --chown=appuser:appuser --from=build /app/package.json ./

RUN mkdir -p /app/certs /app/server/logs && chown -R appuser:appuser /app/certs /app/server/logs

ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider --no-check-certificate https://127.0.0.1:4000/health || exit 1
USER appuser
CMD ["sh", "-c", "npx prisma migrate deploy --schema=server/prisma/schema.prisma && node server/dist/index.js"]
