#!/usr/bin/env bash
#
# Verificação de produção: build + Vitest + (se API estiver ativa) full-system + E2E.
# Uso: ./scripts/run-producao-check.sh
# Ver: docs/PRODUCAO-TESTES.md
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API_URL="${API_URL:-http://localhost:3001}"

echo "═══════════════════════════════════════════════════════════════"
echo "  VERIFICAÇÃO PRÉ-PRODUÇÃO - DSICOLA"
echo "  Build + Testes + Full system (se API ativa)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Build backend
echo "▶ 1/5 Build backend..."
cd "$ROOT/backend"
npm run build
echo "   OK"
echo ""

# 2. Build frontend
echo "▶ 2/5 Build frontend..."
cd "$ROOT/frontend"
npm run build
echo "   OK"
echo ""

# 3. Vitest (testes unitários/integração)
echo "▶ 3/5 Testes Vitest (backend)..."
cd "$ROOT/backend"
npm run test
echo "   OK"
echo ""

# 4. Backend está a correr?
echo "▶ 4/5 Verificar API ($API_URL)..."
API_UP=0
for i in 1 2 3 4 5; do
  if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null | grep -q 200; then
    API_UP=1
    echo "   Backend OK"
    break
  fi
  sleep 1
done
if [ "$API_UP" -eq 0 ]; then
  echo "   Backend não está a correr. Para teste full (API + E2E):"
  echo "   1. Noutro terminal: cd backend && npm run dev"
  echo "   2. Depois: ./scripts/run-full-system-test.sh"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  BUILD + VITEST CONCLUÍDOS (sem API/E2E)"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
fi
echo ""

# 5. Teste full (seeds + test:full-system + E2E)
echo "▶ 5/5 Teste full do sistema (seeds + API + E2E)..."
cd "$ROOT"
./scripts/run-full-system-test.sh
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VERIFICAÇÃO PRÉ-PRODUÇÃO CONCLUÍDA"
echo "═══════════════════════════════════════════════════════════════"
