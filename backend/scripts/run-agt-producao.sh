#!/bin/bash
# Executa verificação e geração de documentos AGT para instituição em produção.
# Requer: railway login + railway link (ou DATABASE_URL de produção)
#
# Uso: ./scripts/run-agt-producao.sh <instituicaoId>
#      railway run ./scripts/run-agt-producao.sh 669440c3-639e-4876-94e9-cc391240de46

set -e
INST_ID="${1:?Forneça o ID da instituição}"
cd "$(dirname "$0")/.."

echo ""
echo "=== 1. Verificando pré-requisitos ==="
npx tsx scripts/verificar-prerequisitos-agt.ts "$INST_ID"
echo ""

echo "=== 2. Gerando documentos Janeiro 2026 ==="
npx tsx scripts/seed-documentos-teste-agt.ts "$INST_ID" 2026-01-15
echo ""

echo "=== 3. Gerando documentos Fevereiro 2026 ==="
npx tsx scripts/seed-documentos-teste-agt.ts "$INST_ID" 2026-02-15
echo ""

echo "=== Concluído ==="
echo "Aceda a Documentos Fiscais → Lista para descarregar os PDFs."
echo "Exporte o SAF-T em Exportar SAFT (ano 2026, Janeiro–Fevereiro)."
echo ""
