# Dockerfile para Railway - Backend DSICOLA
# Usa Debian (node:20-slim) em vez de Alpine - Prisma tem problemas com musl/OpenSSL no Alpine

FROM node:20-slim AS builder

WORKDIR /app

# Prisma schema engine precisa de OpenSSL (evita "failed to detect libssl" e Schema engine error)
# Também instalamos o cliente PostgreSQL 17 (pg_dump 17) a partir do repositório oficial da PostgreSQL
# para ficar alinhado com o Postgres 17 do Railway e evitar "server version mismatch"
RUN apt-get update -y \
  && apt-get install -y wget gnupg2 lsb-release ca-certificates openssl \
  && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
  && apt-get update -y \
  && apt-get install -y postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/*

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

# OpenSSL necessário para Prisma (migrate deploy e generate no runtime/entrypoint)
# postgresql-client-17 (via repositório oficial) fornece o binário pg_dump 17 usado pelo serviço de backups
RUN apt-get update -y \
  && apt-get install -y wget gnupg2 lsb-release ca-certificates openssl \
  && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
  && apt-get update -y \
  && apt-get install -y postgresql-client-17 \
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
