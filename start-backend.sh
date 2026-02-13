#!/bin/bash

# Script para iniciar o backend do DSICOLA

echo "🚀 Iniciando Backend DSICOLA..."
echo ""

# Verificar se estamos na pasta correta
if [ ! -f "backend/package.json" ]; then
    echo "❌ Erro: Execute este script da raiz do projeto (dsicola/)"
    exit 1
fi

# Navegar para a pasta do backend
cd backend

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo "📝 Criando .env com valores padrão..."
    cat > .env << EOF
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola"
JWT_SECRET="change-this-secret-key-in-production"
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173,http://localhost:8080
EOF
    echo "✅ Arquivo .env criado. Por favor, edite com suas configurações!"
    echo ""
fi

# Verificar se o Prisma está configurado
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Erro: schema.prisma não encontrado!"
    exit 1
fi

echo "🔧 Gerando cliente Prisma..."
npm run db:generate

echo ""
echo "🌱 Executando migrations..."
npm run db:push

echo ""
echo "✅ Iniciando servidor..."
echo "📍 Backend estará disponível em: http://localhost:3001"
echo ""

# Iniciar o servidor
npm run dev

