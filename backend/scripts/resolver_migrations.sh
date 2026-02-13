#!/bin/bash

# Script para resolver migrations do Prisma
# Uso: ./scripts/resolver_migrations.sh

set -e

echo "🔧 Resolvendo migrations do Prisma..."
echo ""

cd "$(dirname "$0")/.." || exit

# Lista de migrations para marcar como aplicadas
# Ajuste conforme necessário - apenas as que já estão no banco real
MIGRATIONS=(
  "20250127120000_add_ano_letivo_id_to_semestres_trimestres"
  "20250127150000_add_semestre_audit_fields"
  "20250128000000_add_semestre_audit_fields"
  "20250127180000_add_ano_letivo_id_fix"
  "20260101000134_init_academic_modules"
  "20260102095243_fix_semestre_encerramento_relations"
  "20260108154847_add_ano_letivo_id_to_semestres_trimestres"
  "20260125000000_create_anos_letivos_table"
  "20260130000000_make_ano_letivo_id_required"
)

echo "📋 Marcando migrations como aplicadas..."
echo ""

for migration in "${MIGRATIONS[@]}"; do
  echo "  ✓ Marcando: $migration"
  npx prisma migrate resolve --applied "$migration" || {
    echo "  ⚠️  Aviso: Migration $migration pode já estar aplicada ou não existir"
  }
done

echo ""
echo "🔄 Sincronizando schema com banco real..."
npx prisma db push --accept-data-loss || {
  echo "  ⚠️  Aviso: Algumas mudanças podem requerer atenção manual"
}

echo ""
echo "📦 Gerando Prisma Client..."
npx prisma generate

echo ""
echo "✅ Processo concluído!"
echo ""
echo "📋 Próximos passos:"
echo "  1. Verificar: npx prisma migrate status"
echo "  2. Testar backend: npm run dev"
echo "  3. Validar criação de Ano Letivo e Semestre"
echo ""

