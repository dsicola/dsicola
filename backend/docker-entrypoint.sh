#!/bin/sh
set -e

# Railway Postgres pode expor DATABASE_URL, DATABASE_PUBLIC_URL, ou variáveis separadas
# Garantir que DATABASE_URL existe para o Prisma
if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "postgresql://placeholder:placeholder@localhost:5432/placeholder" ]; then
  echo "[entrypoint] DATABASE_URL já definida"
elif [ -n "$DATABASE_PUBLIC_URL" ]; then
  export DATABASE_URL="$DATABASE_PUBLIC_URL"
  echo "[entrypoint] Usando DATABASE_PUBLIC_URL como DATABASE_URL"
elif [ -n "$POSTGRES_URL" ]; then
  export DATABASE_URL="$POSTGRES_URL"
  echo "[entrypoint] Usando POSTGRES_URL como DATABASE_URL"
elif [ -n "$PGDATABASE_URL" ]; then
  export DATABASE_URL="$PGDATABASE_URL"
  echo "[entrypoint] Usando PGDATABASE_URL como DATABASE_URL"
else
  echo "=============================================="
  echo "ERRO: DATABASE_URL não definida!"
  echo ""
  echo "No Railway:"
  echo "1. Serviço dsicola → Variables"
  echo "2. Adicione DATABASE_URL (copie do serviço Postgres)"
  echo "   ou use 'Add Reference' para ligar ao Postgres"
  echo "=============================================="
  exit 1
fi

echo "[entrypoint] Executando migrations..."
npx prisma migrate deploy

echo "[entrypoint] Iniciando servidor..."
exec node dist/server.js
