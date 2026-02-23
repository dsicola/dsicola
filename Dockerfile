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
RUN npm ci --omit=dev

COPY backend/prisma ./prisma/
# ARG só existe durante o build - NÃO fica na imagem final
# Assim a DATABASE_URL do Railway é usada em runtime (não há placeholder a sobrepor)
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

# Entrypoint tenta DATABASE_URL, DATABASE_PUBLIC_URL, POSTGRES_URL
# e dá erro claro se nenhuma existir
CMD ["./docker-entrypoint.sh"]
