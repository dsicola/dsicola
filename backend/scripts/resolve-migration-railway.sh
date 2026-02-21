#!/bin/bash
# Resolver migração falhada P3009 no Railway
# Uso: DATABASE_URL="postgresql://..." ./scripts/resolve-migration-railway.sh
# Ou exporte DATABASE_URL e execute: ./scripts/resolve-migration-railway.sh

if [ -z "$DATABASE_URL" ]; then
  echo "Erro: defina DATABASE_URL (ex: Railway → Postgres → Variables → DATABASE_URL)"
  exit 1
fi

cd "$(dirname "$0")/.."
npx prisma migrate resolve --rolled-back "20260221133940_add_periodo_lancamento_notas"
echo "Migração marcada como rolled-back. Pode fazer push e redeploy no Railway."
