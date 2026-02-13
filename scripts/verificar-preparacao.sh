#!/bin/bash

# Script de Verificação de Preparação - DSICOLA
# Verifica se o sistema está pronto para testes

set -e

echo "=========================================="
echo "🔍 VERIFICAÇÃO DE PREPARAÇÃO - DSICOLA"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

# Função para verificar item
check_item() {
    local name=$1
    local check=$2
    
    if eval "$check"; then
        echo -e "${GREEN}✅${NC} $name"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌${NC} $name"
        ((FAILED++))
        return 1
    fi
}

# Função para aviso
warn_item() {
    local name=$1
    echo -e "${YELLOW}⚠️${NC} $name"
    ((WARNINGS++))
}

echo "📋 1. VARIÁVEIS DE AMBIENTE"
echo "---------------------------"

# Backend .env
if [ -f "backend/.env" ]; then
    check_item "backend/.env existe" "true"
    
    # Verificar variáveis críticas
    if grep -q "DATABASE_URL" backend/.env; then
        check_item "DATABASE_URL configurado" "true"
    else
        check_item "DATABASE_URL configurado" "false"
    fi
    
    if grep -q "JWT_SECRET" backend/.env; then
        check_item "JWT_SECRET configurado" "true"
    else
        check_item "JWT_SECRET configurado" "false"
    fi
    
    if grep -q "PORT" backend/.env; then
        check_item "PORT configurado" "true"
    else
        warn_item "PORT não configurado (usará padrão 3001)"
    fi
    
    if grep -q "FRONTEND_URL" backend/.env; then
        check_item "FRONTEND_URL configurado" "true"
    else
        warn_item "FRONTEND_URL não configurado (pode causar erros CORS)"
    fi
    
    if grep -q "NODE_ENV" backend/.env; then
        check_item "NODE_ENV configurado" "true"
    else
        warn_item "NODE_ENV não configurado (usará padrão)"
    fi
else
    check_item "backend/.env existe" "false"
    echo "   Crie o arquivo backend/.env com as variáveis necessárias"
fi

# Frontend .env
if [ -f "frontend/.env" ]; then
    check_item "frontend/.env existe" "true"
    
    if grep -q "VITE_API_URL" frontend/.env; then
        check_item "VITE_API_URL configurado" "true"
    else
        check_item "VITE_API_URL configurado" "false"
    fi
else
    check_item "frontend/.env existe" "false"
    echo "   Crie o arquivo frontend/.env com VITE_API_URL=http://localhost:3001"
fi

echo ""
echo "📋 2. SERVIÇOS RODANDO"
echo "---------------------------"

# Backend
if curl -s http://localhost:3001/health > /dev/null 2>&1 || \
   curl -s http://localhost:3001/api/auth/health > /dev/null 2>&1; then
    check_item "Backend rodando (porta 3001)" "true"
else
    check_item "Backend rodando (porta 3001)" "false"
    echo "   Execute: cd backend && npm run dev"
fi

# Frontend
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    check_item "Frontend rodando (porta 8080)" "true"
elif curl -s http://localhost:5173 > /dev/null 2>&1; then
    check_item "Frontend rodando (porta 5173)" "true"
else
    check_item "Frontend rodando" "false"
    echo "   Execute: cd frontend && npm run dev"
fi

echo ""
echo "📋 3. DEPENDÊNCIAS"
echo "---------------------------"

# Backend node_modules
if [ -d "backend/node_modules" ]; then
    check_item "Backend dependências instaladas" "true"
else
    check_item "Backend dependências instaladas" "false"
    echo "   Execute: cd backend && npm install"
fi

# Frontend node_modules
if [ -d "frontend/node_modules" ]; then
    check_item "Frontend dependências instaladas" "true"
else
    check_item "Frontend dependências instaladas" "false"
    echo "   Execute: cd frontend && npm install"
fi

# Prisma Client
if [ -d "backend/node_modules/.prisma" ] || [ -d "backend/node_modules/@prisma/client" ]; then
    check_item "Prisma Client gerado" "true"
else
    check_item "Prisma Client gerado" "false"
    echo "   Execute: cd backend && npm run db:generate"
fi

echo ""
echo "📋 4. BANCO DE DADOS"
echo "---------------------------"

# Verificar se DATABASE_URL está configurado
if [ -f "backend/.env" ] && grep -q "DATABASE_URL" backend/.env; then
    DB_URL=$(grep "DATABASE_URL" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    # Tentar conectar (requer psql)
    if command -v psql > /dev/null 2>&1; then
        if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
            check_item "Banco de dados acessível" "true"
            
            # Verificar migrações
            MIGRATION_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null | tr -d ' ' || echo "0")
            if [ "$MIGRATION_COUNT" -gt "0" ]; then
                check_item "Migrações aplicadas ($MIGRATION_COUNT encontradas)" "true"
            else
                warn_item "Nenhuma migração encontrada (execute: npm run db:migrate)"
            fi
        else
            check_item "Banco de dados acessível" "false"
            echo "   Verifique a DATABASE_URL no backend/.env"
        fi
    else
        warn_item "psql não encontrado - não foi possível verificar conexão"
    fi
else
    warn_item "DATABASE_URL não configurado - não foi possível verificar banco"
fi

echo ""
echo "=========================================="
echo "📊 RESUMO"
echo "=========================================="
echo -e "${GREEN}✅ Passou: $PASSED${NC}"
echo -e "${RED}❌ Falhou: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Avisos: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Sistema pronto para testes!${NC}"
    exit 0
else
    echo -e "${RED}❌ Corrija os itens acima antes de continuar${NC}"
    exit 1
fi

