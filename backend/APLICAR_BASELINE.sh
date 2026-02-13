#!/bin/bash

# ============================================
# SCRIPT: Aplicar Baseline Acadêmico
# ============================================
# Este script aplica o baseline definitivo para resolver erros P3006/P1014
# ============================================

set -e  # Parar em caso de erro

echo "=========================================="
echo "APLICANDO BASELINE ACADÊMICO"
echo "=========================================="
echo ""

# Verificar se está no diretório correto
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ ERRO: Execute este script a partir do diretório backend/"
    exit 1
fi

# Confirmar ambiente
echo "⚠️  ATENÇÃO: Este script vai RESETAR o banco de dados local!"
echo "   Certifique-se de que este é um ambiente de DESENVOLVIMENTO."
echo ""
read -p "Continuar? (s/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operação cancelada."
    exit 1
fi

echo ""
echo "📋 Passo 1: Validar schema Prisma..."
npx prisma validate

echo ""
echo "📋 Passo 2: Resetar migrations (vai dropar e recriar banco)..."
npx prisma migrate reset --skip-seed

echo ""
echo "📋 Passo 3: Aplicar baseline..."
npx prisma migrate deploy

echo ""
echo "📋 Passo 4: Gerar Prisma Client..."
npx prisma generate

echo ""
echo "📋 Passo 5: Validar status..."
npx prisma migrate status

echo ""
echo "=========================================="
echo "✅ BASELINE APLICADO COM SUCESSO!"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "1. Verificar se não há erros P3006/P1014"
echo "2. Testar criar Ano Letivo"
echo "3. Testar criar Semestre"
echo "4. Testar criar Trimestre"
echo ""
echo "Para abrir Prisma Studio:"
echo "  npx prisma studio"
echo ""

