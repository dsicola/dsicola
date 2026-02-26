#!/usr/bin/env bash
#
# Testar restauração de um backup (obrigatório para ROADMAP-100).
# NÃO usar na base de produção. Usar apenas em base de teste/clone.
#
# Uso:
#   BACKUP_FILE=/caminho/para/backup.sql TEST_DATABASE_URL="postgresql://..." ./scripts/test-restore-backup.sh
#
# Ou, após criar uma DB de teste:
#   createdb dsicola_restore_test
#   export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/dsicola_restore_test"
#   BACKUP_FILE=./backups/backup_20260101_120000.sql ./scripts/test-restore-backup.sh
#

set -e

if [ -z "$BACKUP_FILE" ] || [ -z "$TEST_DATABASE_URL" ]; then
  echo "Uso: BACKUP_FILE=/caminho/backup.sql TEST_DATABASE_URL='postgresql://...' $0"
  echo "Cria a DB de teste, restaura o backup e executa verificações básicas."
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Ficheiro de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "=== Teste de restauração de backup ==="
echo "Backup: $BACKUP_FILE"
echo "Base de teste: $TEST_DATABASE_URL"
echo ""

echo "[1/3] Restaurar backup..."
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
echo "Restauração concluída."

echo "[2/3] Verificar tabelas críticas..."
psql "$TEST_DATABASE_URL" -t -c "
  SELECT 'users: ' || COUNT(*) FROM \"users\"
  UNION ALL SELECT 'instituicoes: ' || COUNT(*) FROM \"instituicoes\"
  UNION ALL SELECT 'matriculas: ' || COUNT(*) FROM \"matriculas\"
  UNION ALL SELECT 'mensalidades: ' || COUNT(*) FROM \"mensalidades\";
"

echo "[3/3] Teste concluído. Arranque o backend com DATABASE_URL=$TEST_DATABASE_URL para validar a aplicação."
echo "Exemplo: cd backend && DATABASE_URL=\"$TEST_DATABASE_URL\" npm run dev"
echo ""
echo "Após validação, pode apagar a base de teste (ex.: dropdb dsicola_restore_test)."
