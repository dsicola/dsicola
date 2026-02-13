#!/bin/bash

# Script de diagnóstico para problemas de CORS e conexão
# Uso: ./diagnostico-cors.sh

echo "=========================================="
echo "Diagnóstico de CORS e Conexão DSICOLA"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se o backend está rodando
echo "1. Verificando se o backend está rodando..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend está rodando em http://localhost:3001${NC}"
    curl -s http://localhost:3001/api/health | jq '.' 2>/dev/null || curl -s http://localhost:3001/api/health
else
    echo -e "${RED}✗ Backend NÃO está rodando em http://localhost:3001${NC}"
    echo "  Execute: cd backend && npm run dev"
fi
echo ""

# 2. Verificar variáveis de ambiente do backend
echo "2. Verificando variáveis de ambiente do backend..."
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✓ Arquivo backend/.env existe${NC}"
    if grep -q "FRONTEND_URL" backend/.env; then
        echo "  FRONTEND_URL:"
        grep "FRONTEND_URL" backend/.env | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ FRONTEND_URL não encontrado em backend/.env${NC}"
        echo "  Adicione: FRONTEND_URL=http://localhost:8080,http://localhost:5173"
    fi
    if grep -q "PORT" backend/.env; then
        echo "  PORT:"
        grep "PORT" backend/.env | sed 's/^/    /'
    fi
else
    echo -e "${YELLOW}⚠ Arquivo backend/.env não encontrado${NC}"
    echo "  Crie o arquivo com:"
    echo "    FRONTEND_URL=http://localhost:8080,http://localhost:5173"
    echo "    PORT=3001"
fi
echo ""

# 3. Verificar variáveis de ambiente do frontend
echo "3. Verificando variáveis de ambiente do frontend..."
if [ -f "frontend/.env.local" ]; then
    echo -e "${GREEN}✓ Arquivo frontend/.env.local existe${NC}"
    if grep -q "VITE_API_URL" frontend/.env.local; then
        echo "  VITE_API_URL:"
        grep "VITE_API_URL" frontend/.env.local | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ VITE_API_URL não encontrado em frontend/.env.local${NC}"
        echo "  Adicione: VITE_API_URL=http://localhost:3001"
    fi
elif [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓ Arquivo frontend/.env existe${NC}"
    if grep -q "VITE_API_URL" frontend/.env; then
        echo "  VITE_API_URL:"
        grep "VITE_API_URL" frontend/.env | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ VITE_API_URL não encontrado em frontend/.env${NC}"
        echo "  Adicione: VITE_API_URL=http://localhost:3001"
    fi
else
    echo -e "${YELLOW}⚠ Arquivo frontend/.env.local ou frontend/.env não encontrado${NC}"
    echo "  Crie frontend/.env.local com:"
    echo "    VITE_API_URL=http://localhost:3001"
fi
echo ""

# 4. Testar CORS com curl
echo "4. Testando CORS com curl..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "  Testando requisição OPTIONS (preflight):"
    CORS_TEST=$(curl -s -X OPTIONS http://localhost:3001/api/health \
        -H "Origin: http://localhost:8080" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -v 2>&1 | grep -i "access-control")
    
    if [ -n "$CORS_TEST" ]; then
        echo -e "${GREEN}✓ Headers CORS encontrados:${NC}"
        echo "$CORS_TEST" | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ Headers CORS não encontrados na resposta${NC}"
    fi
else
    echo -e "${RED}✗ Não é possível testar CORS - backend não está rodando${NC}"
fi
echo ""

# 5. Verificar portas em uso
echo "5. Verificando portas em uso..."
if command -v lsof > /dev/null 2>&1; then
    PORT_3001=$(lsof -i :3001 2>/dev/null | wc -l)
    PORT_8080=$(lsof -i :8080 2>/dev/null | wc -l)
    
    if [ "$PORT_3001" -gt 0 ]; then
        echo -e "${GREEN}✓ Porta 3001 está em uso (backend)${NC}"
    else
        echo -e "${RED}✗ Porta 3001 NÃO está em uso${NC}"
    fi
    
    if [ "$PORT_8080" -gt 0 ]; then
        echo -e "${GREEN}✓ Porta 8080 está em uso (frontend)${NC}"
    else
        echo -e "${YELLOW}⚠ Porta 8080 NÃO está em uso (frontend pode não estar rodando)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ lsof não disponível - não é possível verificar portas${NC}"
fi
echo ""

# 6. Resumo e recomendações
echo "=========================================="
echo "Resumo e Recomendações:"
echo "=========================================="
echo ""
echo "1. Certifique-se de que o backend está rodando:"
echo "   cd backend && npm run dev"
echo ""
echo "2. Certifique-se de que o frontend está rodando:"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Verifique os arquivos .env:"
echo "   - backend/.env deve ter: FRONTEND_URL=http://localhost:8080,http://localhost:5173"
echo "   - frontend/.env.local deve ter: VITE_API_URL=http://localhost:3001"
echo ""
echo "4. Reinicie ambos os servidores após modificar .env"
echo ""
echo "5. Verifique o console do navegador (F12) para logs de API"
echo ""
echo "6. Verifique os logs do backend para mensagens de CORS"
echo ""

