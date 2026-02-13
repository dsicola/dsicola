#!/bin/bash

echo "🔍 Verificando Conexão API DSICOLA"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se backend está rodando
echo "1️⃣ Verificando Backend (porta 3001)..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Backend está rodando na porta 3001${NC}"
else
    echo -e "${RED}❌ Backend NÃO está rodando na porta 3001${NC}"
    echo "   Execute: cd backend && npm run dev"
fi
echo ""

# 2. Verificar se frontend está rodando
echo "2️⃣ Verificando Frontend (porta 8080)..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Frontend está rodando na porta 8080${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend não está rodando na porta 8080${NC}"
    echo "   Execute: cd frontend && npm run dev"
fi
echo ""

# 3. Verificar arquivo .env do backend
echo "3️⃣ Verificando backend/.env..."
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ Arquivo backend/.env existe${NC}"
    
    # Verificar variáveis importantes
    if grep -q "FRONTEND_URL" backend/.env; then
        echo -e "${GREEN}✅ FRONTEND_URL está configurado${NC}"
        echo "   Valor: $(grep FRONTEND_URL backend/.env | cut -d '=' -f2)"
    else
        echo -e "${YELLOW}⚠️  FRONTEND_URL não encontrado${NC}"
        echo "   Adicione: FRONTEND_URL=http://localhost:8080,http://localhost:5173"
    fi
    
    if grep -q "PORT" backend/.env; then
        PORT=$(grep PORT backend/.env | cut -d '=' -f2)
        echo -e "${GREEN}✅ PORT está configurado: ${PORT}${NC}"
    else
        echo -e "${YELLOW}⚠️  PORT não encontrado (usando padrão 3001)${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo backend/.env NÃO existe${NC}"
    echo "   Crie o arquivo com: PORT=3001, FRONTEND_URL=http://localhost:8080"
fi
echo ""

# 4. Verificar arquivo .env do frontend
echo "4️⃣ Verificando frontend/.env..."
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✅ Arquivo frontend/.env existe${NC}"
    
    if grep -q "VITE_API_URL" frontend/.env; then
        echo -e "${GREEN}✅ VITE_API_URL está configurado${NC}"
        echo "   Valor: $(grep VITE_API_URL frontend/.env | cut -d '=' -f2)"
    else
        echo -e "${YELLOW}⚠️  VITE_API_URL não encontrado${NC}"
        echo "   Adicione: VITE_API_URL=http://localhost:3001"
    fi
else
    echo -e "${RED}❌ Arquivo frontend/.env NÃO existe${NC}"
    echo "   Crie o arquivo com: VITE_API_URL=http://localhost:3001"
fi
echo ""

# 5. Testar conexão com backend
echo "5️⃣ Testando conexão com backend..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend responde em http://localhost:3001${NC}"
elif curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend responde em http://localhost:3001 (sem /health)${NC}"
else
    echo -e "${RED}❌ Backend NÃO responde em http://localhost:3001${NC}"
    echo "   Verifique se o backend está rodando"
fi
echo ""

# 6. Resumo
echo "=================================="
echo "📋 Resumo:"
echo ""

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 && [ -f "backend/.env" ] && [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✅ Configuração parece correta!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Verifique o console do navegador (F12)"
    echo "2. Procure por: [API] Using API URL: http://localhost:3001"
    echo "3. Se ainda houver erro, verifique CORS no console"
else
    echo -e "${YELLOW}⚠️  Alguns problemas encontrados${NC}"
    echo ""
    echo "Ações necessárias:"
    [ ! -f "backend/.env" ] && echo "- Criar backend/.env"
    [ ! -f "frontend/.env" ] && echo "- Criar frontend/.env"
    ! lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 && echo "- Iniciar backend: cd backend && npm run dev"
fi

echo ""
echo "📖 Para mais detalhes, consulte: DIAGNOSTICO_CONEXAO_API.md"

