#!/usr/bin/env bash
#
# E2E: Importar estudantes (Playwright + backend + frontend).
# Uso (na raiz do repositório):
#   bash scripts/run-e2e-import-estudantes.sh
#
# Opcional: sem seeds (se a BD já tiver admin.inst.a@teste.dsicola.com):
#   SKIP_SEED=1 bash scripts/run-e2e-import-estudantes.sh
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  echo ""
  echo "▶ A parar servidores (3001, 8080)..."
  lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1
}
trap cleanup EXIT

cleanup

if [ -z "${SKIP_SEED:-}" ]; then
  echo "▶ Seeds (multi-tenant + perfis) — defina SKIP_SEED=1 para saltar"
  cd "$ROOT/backend"
  npx tsx scripts/seed-multi-tenant-test.ts
  npx tsx scripts/seed-perfis-completos.ts
  echo "   OK"
else
  echo "▶ Seeds saltados (SKIP_SEED=1)"
fi
echo ""

echo "▶ Backend (porta 3001)..."
cd "$ROOT/backend"
npm run dev &
echo ""

echo "▶ Frontend (127.0.0.1:8080)..."
cd "$ROOT/frontend"
E2E_HOST=127.0.0.1 npm run dev &
echo ""

echo "▶ À espera de /health e do Vite..."
for i in $(seq 1 30); do
  BE=false
  FE=false
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health 2>/dev/null | grep -q 200 && BE=true
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 2>/dev/null | grep -qE "200|304" && FE=true
  if $BE && $FE; then
    echo "   Backend OK | Frontend OK"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERRO: timeout à espera dos servidores (BE=$BE FE=$FE)"
    exit 1
  fi
  sleep 2
done
echo ""

cd "$ROOT/frontend"
echo "▶ Playwright browsers (primeira vez pode demorar a descarregar Chromium)..."
npx playwright install chromium

echo "▶ Playwright: e2e/import-estudantes.spec.ts"
set +e
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://127.0.0.1:8080 npx playwright test e2e/import-estudantes.spec.ts --project=chromium
CODE=$?
set -e

if [ "$CODE" -ne 0 ]; then
  echo "ERRO: E2E falhou (exit $CODE)"
  exit "$CODE"
fi

echo ""
echo "✓ E2E importar estudantes concluído com sucesso."
exit 0
