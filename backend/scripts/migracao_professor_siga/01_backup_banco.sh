#!/bin/bash

# ============================================================
# SCRIPT DE BACKUP - MIGRAÇÃO PROFESSOR SIGA/SIGAE
# ============================================================
# OBJETIVO: Criar backup completo do banco antes da migração
# ============================================================
# DATA: 2025-01-XX
# SISTEMA: DSICOLA
# ============================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ETAPA 1: BACKUP DE SEGURANÇA${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ ERRO: DATABASE_URL não está definida${NC}"
  echo "   Defina a variável de ambiente DATABASE_URL antes de executar"
  exit 1
fi

# Extrair informações do DATABASE_URL
# Formato: postgresql://user:password@host:port/database
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups_migracao_professor"
BACKUP_FILE="${BACKUP_DIR}/backup_pre_migracao_${TIMESTAMP}.sql"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Criando backup do banco de dados...${NC}"
echo "   Banco: $DB_NAME"
echo "   Arquivo: $BACKUP_FILE"
echo ""

# Criar backup usando pg_dump
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
  echo "   Tamanho: $BACKUP_SIZE"
  echo "   Local: $(pwd)/$BACKUP_FILE"
  echo ""
  
  # Verificar integridade do backup
  echo -e "${YELLOW}🔍 Verificando integridade do backup...${NC}"
  if grep -q "PostgreSQL database dump" "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup válido (contém header PostgreSQL)${NC}"
  else
    echo -e "${RED}⚠️  AVISO: Backup pode estar corrompido (header não encontrado)${NC}"
  fi
  
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ BACKUP CONCLUÍDO COM SUCESSO${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "📝 IMPORTANTE: Guarde este backup em local seguro antes de continuar!"
  echo ""
  
  # Exportar caminho do backup para uso em outros scripts
  echo "$BACKUP_FILE" > "${BACKUP_DIR}/.ultimo_backup"
  
  exit 0
else
  echo -e "${RED}❌ ERRO: Falha ao criar backup${NC}"
  echo "   Verifique se:"
  echo "   - DATABASE_URL está correta"
  echo "   - Você tem permissão para acessar o banco"
  echo "   - pg_dump está instalado"
  exit 1
fi

