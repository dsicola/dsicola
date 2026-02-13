#!/bin/bash

# Script para resetar banco de dados completamente
# ATENÇÃO: Este script deleta TODOS os dados!

set -e

echo "⚠️  =========================================="
echo "⚠️  ATENÇÃO: RESET COMPLETO DO BANCO DE DADOS"
echo "⚠️  =========================================="
echo ""
echo "Este script irá:"
echo "  ❌ DELETAR TODOS OS DADOS"
echo "  ❌ DELETAR TODAS AS TABELAS"
echo "  ✅ RECRIAR O SCHEMA DO ZERO"
echo "  ✅ EXECUTAR TODAS AS MIGRATIONS"
echo "  ✅ EXECUTAR SEED (criar SUPER_ADMIN)"
echo ""
read -p "Tem certeza que deseja continuar? (digite 'sim' para confirmar): " confirmacao

if [ "$confirmacao" != "sim" ]; then
    echo "❌ Operação cancelada."
    exit 1
fi

echo ""
echo "🔄 Iniciando reset do banco de dados..."
echo ""

# Ir para o diretório backend
cd "$(dirname "$0")/.."

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "   Crie o arquivo .env com DATABASE_URL configurado."
    exit 1
fi

# Verificar se DATABASE_URL está configurado
if ! grep -q "DATABASE_URL" .env; then
    echo "❌ DATABASE_URL não encontrado no .env!"
    exit 1
fi

# Resetar banco
echo "📦 Resetando banco de dados..."
npx prisma migrate reset --force

echo ""
echo "✅ Banco de dados resetado com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Verificar se SUPER_ADMIN foi criado (via seed)"
echo "   2. Fazer login como SUPER_ADMIN"
echo "   3. Criar instituição de teste"
echo "   4. Criar usuários de teste (ADMIN, SECRETARIA, PROFESSOR, ALUNO)"
echo "   5. Começar os testes seguindo TESTES_PRE_PRODUCAO.md"
echo ""
echo "🔐 Credenciais padrão do SUPER_ADMIN:"
echo "   Email: superadmin@dsicola.com"
echo "   Senha: SuperAdmin@123"
echo "   (ou conforme configurado no .env)"
echo ""

