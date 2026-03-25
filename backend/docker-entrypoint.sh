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

# CLI Prisma vem de dependencies (npm ci --omit=dev); usar binário local.
PRISMA_BIN="./node_modules/.bin/prisma"
echo "[entrypoint] A desbloquear migrações falhadas (P3009), se existirem..."
# 20260325160000_social_groups: nome antigo (ordem errada); na BD pode ficar como falhada — resolve liberta o deploy.
# A migração correta no repo é 20260325185000_social_groups (depois de social_module).
for _mig in \
  "20260221133940_add_periodo_lancamento_notas" \
  "20260325160000_social_groups"
do
  echo "[entrypoint] migrate resolve --rolled-back ${_mig} ..."
  if "$PRISMA_BIN" migrate resolve --rolled-back "$_mig"; then
    echo "[entrypoint] OK: ${_mig} marcada como rolled-back"
  else
    echo "[entrypoint] Ignorar ${_mig}: não está falhada ou já resolvida"
  fi
done

echo "[entrypoint] Executando migrations..."
"$PRISMA_BIN" migrate deploy

echo "[entrypoint] Executando seed (cria super-admin se não existir)..."
"$PRISMA_BIN" db seed || true

echo "[entrypoint] Iniciando servidor..."
exec node dist/server.js
