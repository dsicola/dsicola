# Dockerfile para Railway - Backend DSICOLA
# Usa Debian (node:20-slim) em vez de Alpine - Prisma tem problemas com musl/OpenSSL no Alpine

FROM node:20-slim AS builder

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Prisma precisa de DATABASE_URL para validar o schema; no build usamos placeholder
# (a URL real vem do Railway em runtime)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npm ci
RUN npx prisma generate

COPY backend/ ./

RUN npm run build

FROM node:20-slim AS production

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/prisma ./prisma/
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
