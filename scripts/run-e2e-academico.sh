#!/usr/bin/env bash
#
# Executa E2E académico (ROADMAP-100): seed multi-tenant, backend, frontend, testes com Chrome.
# Uso: ./scripts/run-e2e-academico.sh
# Requer: Node, npm, Google Chrome (para evitar crash do Chromium), base de dados acessível.
#
# Se backend (3001) ou frontend (8080) já estiverem a correr, usa-os. Caso contrário, inicia-os
# e termina-os no fim do script.
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "   A parar backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "   A parar frontend (PID $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "═══════════════════════════════════════════════════════════════"
echo "  E2E ACADÉMICO - Lançar notas (Secundário + Superior) + Pauta"
echo "  Multi-tenant | Chrome"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Backend
echo "▶ 1/5 Backend ($BACKEND_URL)..."
if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null | grep -q 200; then
  echo "   Já a correr."
else
  echo "   A iniciar backend..."
  (cd "$ROOT/backend" && npm run dev) &
  BACKEND_PID=$!
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null | grep -q 200; then
      echo "   Backend OK"
      break
    fi
    if [ "$i" -eq 15 ]; then
      echo "   ERRO: Backend não responde em $BACKEND_URL"
      exit 1
    fi
    sleep 2
  done
fi
echo ""

# 2. Seed multi-tenant
echo "▶ 2/5 Seed multi-tenant (Inst A Secundário + Inst B Superior)..."
cd "$ROOT/backend"
npx tsx scripts/seed-multi-tenant-test.ts
echo "   OK"
echo ""

# 3. Frontend
echo "▶ 3/5 Frontend ($FRONTEND_URL)..."
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null | grep -q 200; then
  echo "   Já a correr."
else
  echo "   A iniciar frontend..."
  (cd "$ROOT/frontend" && npm run dev) &
  FRONTEND_PID=$!
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null | grep -q 200; then
      echo "   Frontend OK"
      break
    fi
    if [ "$i" -eq 15 ]; then
      echo "   ERRO: Frontend não responde em $FRONTEND_URL"
      exit 1
    fi
    sleep 2
  done
fi
echo ""

# 4. Playwright Chrome (opcional)
echo "▶ 4/5 Playwright (Chrome)..."
cd "$ROOT/frontend"
if ! npx playwright install chrome 2>/dev/null; then
  echo "   Aviso: Chrome já instalado ou instalação ignorada. A continuar..."
fi
echo ""

# 5. E2E académico
# Se Chrome crashar (SIGABRT): npx playwright install firefox && PLAYWRIGHT_PROJECT=firefox ./scripts/run-e2e-academico.sh
PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-chrome}"
echo "▶ 5/5 E2E académico (roadmap-100-academico, projeto $PLAYWRIGHT_PROJECT)..."
cd "$ROOT/frontend"
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL="$FRONTEND_URL" npx playwright test e2e/roadmap-100-academico.spec.ts --project="$PLAYWRIGHT_PROJECT" --reporter=list
EXIT_CODE=$?
echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  E2E ACADÉMICO CONCLUÍDO - Todos os testes passaram"
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  E2E ACADÉMICO - Alguns testes falharam (código $EXIT_CODE)"
  echo "═══════════════════════════════════════════════════════════════"
fi
exit "$EXIT_CODE"
