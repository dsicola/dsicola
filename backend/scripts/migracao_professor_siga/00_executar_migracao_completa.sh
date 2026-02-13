#!/bin/bash

# ============================================================
# SCRIPT MASTER - MIGRAÇÃO PROFESSOR SIGA/SIGAE
# ============================================================
# OBJETIVO: Executar migração completa de forma segura e controlada
# ============================================================
# DATA: 2025-01-XX
# SISTEMA: DSICOLA
# ============================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MIGRAÇÃO PROFESSOR SIGA/SIGAE - DSICOLA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Esta migração altera dados críticos do banco!${NC}"
echo ""
echo "Esta migração irá:"
echo "  1. Criar backup completo do banco"
echo "  2. Popular tabela professores"
echo "  3. Migrar plano_ensino.professor_id (users.id → professores.id)"
echo "  4. Validar resultados"
echo ""
read -p "Deseja continuar? (sim/não): " resposta

if [[ ! "$resposta" =~ ^[Ss][Ii][Mm]$ ]]; then
  echo -e "${YELLOW}Migração cancelada pelo usuário.${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  INICIANDO MIGRAÇÃO${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================
# ETAPA 1: BACKUP
# ============================================================
echo -e "${BLUE}[ETAPA 1/5] Criando backup...${NC}"
if bash "$SCRIPT_DIR/01_backup_banco.sh"; then
  echo -e "${GREEN}✅ Backup criado com sucesso${NC}"
else
  echo -e "${RED}❌ ERRO: Falha ao criar backup${NC}"
  echo -e "${RED}   Migração abortada por segurança${NC}"
  exit 1
fi
echo ""

# ============================================================
# ETAPA 2: VALIDAÇÃO PRÉ-MIGRAÇÃO
# ============================================================
echo -e "${BLUE}[ETAPA 2/5] Validando estado do banco...${NC}"
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERRO: DATABASE_URL não está definida${NC}"
  exit 1
fi

if psql "$DATABASE_URL" -f "$SCRIPT_DIR/02_validacao_pre_migracao.sql" > /tmp/migracao_validacao.log 2>&1; then
  cat /tmp/migracao_validacao.log
  echo -e "${GREEN}✅ Validação pré-migração concluída${NC}"
else
  echo -e "${RED}❌ ERRO: Falha na validação pré-migração${NC}"
  echo "Log:"
  cat /tmp/migracao_validacao.log
  exit 1
fi
echo ""

# Perguntar se deseja continuar após validação
read -p "Deseja continuar com a migração? (sim/não): " resposta
if [[ ! "$resposta" =~ ^[Ss][Ii][Mm]$ ]]; then
  echo -e "${YELLOW}Migração cancelada pelo usuário.${NC}"
  exit 0
fi

# ============================================================
# ETAPA 3: POPULAR PROFESSORES
# ============================================================
echo -e "${BLUE}[ETAPA 3/5] Populando tabela professores...${NC}"
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/03_popular_professores.sql" > /tmp/migracao_professores.log 2>&1; then
  cat /tmp/migracao_professores.log
  echo -e "${GREEN}✅ Tabela professores populada${NC}"
else
  echo -e "${RED}❌ ERRO: Falha ao popular professores${NC}"
  echo "Log:"
  cat /tmp/migracao_professores.log
  exit 1
fi
echo ""

# ============================================================
# ETAPA 4: MIGRAR PLANO_ENSINO
# ============================================================
echo -e "${BLUE}[ETAPA 4/5] Migrando plano_ensino.professor_id...${NC}"
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/04_migrar_plano_ensino.sql" > /tmp/migracao_plano_ensino.log 2>&1; then
  cat /tmp/migracao_plano_ensino.log
  echo -e "${GREEN}✅ Migração de plano_ensino concluída${NC}"
else
  echo -e "${RED}❌ ERRO: Falha ao migrar plano_ensino${NC}"
  echo "Log:"
  cat /tmp/migracao_plano_ensino.log
  exit 1
fi
echo ""

# ============================================================
# ETAPA 5: VERIFICAÇÃO PÓS-MIGRAÇÃO
# ============================================================
echo -e "${BLUE}[ETAPA 5/5] Verificando resultados...${NC}"
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/05_verificacao_pos_migracao.sql" > /tmp/migracao_verificacao.log 2>&1; then
  cat /tmp/migracao_verificacao.log
  echo -e "${GREEN}✅ Verificação concluída${NC}"
else
  echo -e "${RED}❌ ERRO: Falha na verificação${NC}"
  echo "Log:"
  cat /tmp/migracao_verificacao.log
  exit 1
fi
echo ""

# ============================================================
# RESUMO FINAL
# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ MIGRAÇÃO CONCLUÍDA!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 PRÓXIMOS PASSOS:${NC}"
echo ""
echo "1. Atualizar Prisma Client:"
echo "   cd backend && npx prisma generate"
echo ""
echo "2. Reiniciar o backend:"
echo "   npm run dev"
echo ""
echo "3. Testar:"
echo "   - Login de professores"
echo "   - Painel do professor"
echo "   - Visualização de planos de ensino"
echo ""
echo "4. Se necessário, restaurar backup:"
BACKUP_FILE=$(cat backups_migracao_professor/.ultimo_backup 2>/dev/null || echo "backups_migracao_professor/backup_*.sql")
echo "   psql \$DATABASE_URL < $BACKUP_FILE"
echo ""
echo -e "${GREEN}✅ Migração executada com sucesso!${NC}"
echo ""

