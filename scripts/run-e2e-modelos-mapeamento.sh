#!/usr/bin/env bash
#
# Executa E2E de Modelos e Mapeamento de Documentos.
# Liga backend e frontend se não estiverem a correr; depois corre os testes.
#
# Uso: ./scripts/run-e2e-modelos-mapeamento.sh
# Requer: Node, npm, base de dados acessível, Chromium (npx playwright install chromium).
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
echo "  E2E Modelos e Mapeamento de Documentos"
echo "  Backend + Frontend (iniciados se necessário)"
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
echo "▶ 2/5 Seed multi-tenant..."
cd "$ROOT/backend"
npx tsx scripts/seed-multi-tenant-test.ts
echo "   OK"
echo ""

# 3. Seed perfis completos
echo "▶ 3/5 Seed perfis completos..."
cd "$ROOT/backend"
npx tsx scripts/seed-perfis-completos.ts
echo "   OK"
echo ""

# 4. Frontend
echo "▶ 4/5 Frontend ($FRONTEND_URL)..."
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

# 5. Playwright E2E
echo "▶ 5/5 Playwright E2E (modelos-mapeamento)..."
cd "$ROOT/frontend"
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL="$FRONTEND_URL" npx playwright test e2e/modelos-mapeamento-documentos.spec.ts --project=chromium --reporter=list
EXIT_CODE=$?
echo ""

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  E2E Modelos e Mapeamento CONCLUÍDO - Todos os testes passaram"
  echo "═══════════════════════════════════════════════════════════════"
  exit 0
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  E2E Modelos e Mapeamento - Alguns testes falharam (exit $EXIT_CODE)"
  echo "═══════════════════════════════════════════════════════════════"
  exit "$EXIT_CODE"
fi
