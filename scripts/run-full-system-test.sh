#!/usr/bin/env bash
#
# Executa o teste full do sistema: seeds, backend (multi-tenant + todos os perfis), E2E.
# Uso: ./scripts/run-full-system-test.sh
# Requer: Node, npm, base de dados acessível pelo backend.
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════════════════════════════"
echo "  TESTE FULL DO SISTEMA - DSICOLA"
echo "  Multi-tenant + Secundário/Superior + Todos os perfis"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Seeds
echo "▶ 1/4 Seeds (multi-tenant + perfis completos)..."
cd "$ROOT/backend"
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts
echo "   OK"
echo ""

# 2. Backend deve estar a correr
echo "▶ 2/4 Verificar backend (http://localhost:3001)..."
API_URL="${API_URL:-http://localhost:3001}"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null | grep -q 200; then
    echo "   Backend OK"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "   ERRO: Backend não responde em $API_URL. Inicia com: cd backend && npm run dev"
    exit 1
  fi
  sleep 2
done
echo ""

# 3. Teste full backend (multi-tenant + tipos + suite todos os perfis)
echo "▶ 3/4 Backend: test:full-system..."
cd "$ROOT/backend"
npm run test:full-system
echo ""

# 4. E2E (Playwright)
echo "▶ 4/4 Frontend E2E: full-system-multitenant..."
cd "$ROOT/frontend"
if ! npx playwright install chromium 2>/dev/null; then
  echo "   Aviso: 'npx playwright install chromium' falhou ou já instalado. A continuar..."
fi
npm run test:e2e:full-system
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  TESTE FULL CONCLUÍDO"
echo "═══════════════════════════════════════════════════════════════"
