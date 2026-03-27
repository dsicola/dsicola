#!/usr/bin/env bash
#
# E2E INSTITUCIONAL COMPLETO — seeds, backend, frontend, suite Playwright (manifest).
#
# Uso (recomendado no terminal do sistema, fora de sandboxes que bloqueiem browser):
#   ./scripts/run-e2e-institutional-full.sh
#   INSTITUTIONAL_SUITE=core ./scripts/run-e2e-institutional-full.sh
#
# Variáveis:
#   INSTITUTIONAL_SUITE=core|full   (padrão: full)
#   E2E_PLAYWRIGHT_TIMEOUT_MS=120000  timeout por teste (opcional)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SUITE="${INSTITUTIONAL_SUITE:-full}"
case "$SUITE" in
  core)
    MANIFEST="$ROOT/frontend/e2e/institutional-suite-core.manifest.txt"
    ;;
  full)
    MANIFEST="$ROOT/frontend/e2e/institutional-suite-full.manifest.txt"
    ;;
  *)
    echo "INSTITUTIONAL_SUITE inválido: use core ou full (recebido: $SUITE)"
    exit 1
    ;;
esac

SPEC_ARR=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  line="${line//$'\r'/}"
  [[ -z "${line// }" ]] && continue
  SPEC_ARR+=("$line")
done <"$MANIFEST"

if [[ ${#SPEC_ARR[@]} -eq 0 ]]; then
  echo "ERRO: manifest vazio ou inválido: $MANIFEST"
  exit 1
fi

cleanup() {
  echo ""
  echo "▶ Limpeza: a parar servidores..."
  lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 2
}
trap cleanup EXIT

echo "═══════════════════════════════════════════════════════════════"
echo "  E2E INSTITUCIONAL — suite: $SUITE (${#SPEC_ARR[@]} ficheiros)"
echo "  Manifest: $MANIFEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cleanup

echo "▶ 1/5 Seeds (multi-tenant + perfis completos)..."
cd "$ROOT/backend"
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts
echo "   OK"
echo ""

echo "▶ 2/5 Backend (porta 3001)..."
cd "$ROOT/backend"
npm run dev &
echo ""

echo "▶ 3/5 Frontend (porta 8080)..."
cd "$ROOT/frontend"
E2E_HOST=127.0.0.1 npm run dev &
echo ""

echo "▶ 4/5 Aguardar servidores..."
for i in $(seq 1 25); do
  BACKEND_OK=false
  FRONTEND_OK=false
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null | grep -q 200 && BACKEND_OK=true
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 2>/dev/null | grep -qE "200|304" && FRONTEND_OK=true
  if $BACKEND_OK && $FRONTEND_OK; then
    echo "   Backend OK | Frontend OK"
    break
  fi
  if [[ "$i" -eq 25 ]]; then
    echo "   ERRO: Timeout à espera dos servidores."
    exit 1
  fi
  sleep 2
done
echo ""

echo "▶ 5/5 Playwright (${#SPEC_ARR[@]} specs)..."
cd "$ROOT/frontend"
npx playwright install chromium 2>/dev/null || true
set +e
if [[ -n "${E2E_PLAYWRIGHT_TIMEOUT_MS:-}" ]]; then
  E2E_SKIP_WEB_SERVER=1 npx playwright test "${SPEC_ARR[@]}" --project=chromium \
    --timeout="${E2E_PLAYWRIGHT_TIMEOUT_MS}"
else
  # Sem --timeout opcional: evita "${arr[@]}" em array vazio com set -u (Bash 3.2 no macOS).
  E2E_SKIP_WEB_SERVER=1 npx playwright test "${SPEC_ARR[@]}" --project=chromium
fi
TEST_EXIT=$?
set -e

echo ""
if [[ "$TEST_EXIT" -eq 0 ]]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ E2E INSTITUCIONAL ($SUITE) CONCLUÍDO COM SUCESSO"
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ❌ E2E INSTITUCIONAL FALHOU (exit: $TEST_EXIT)"
  echo "  Dica: INSTITUTIONAL_SUITE=core para suite mais curta."
  echo "  Ver: docs/TESTE_FULL_SISTEMA_E2E.md"
  echo "═══════════════════════════════════════════════════════════════"
fi

exit "$TEST_EXIT"
