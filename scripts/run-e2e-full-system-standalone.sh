#!/usr/bin/env bash
#
# TESTE E2E FULL-SYSTEM 100% AUTÓNOMO
# Inicia backend + frontend, corre seeds, executa testes E2E.
# Uso: ./scripts/run-e2e-full-system-standalone.sh
# Correr no terminal (fora do Cursor) para evitar erros de sandbox.
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Limpar processos nas portas 3001 e 8080
cleanup() {
  echo ""
  echo "▶ Limpeza: a parar servidores..."
  lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 2
}
trap cleanup EXIT

echo "═══════════════════════════════════════════════════════════════"
echo "  TESTE E2E FULL-SYSTEM - STANDALONE (100% automático)"
echo "  Backend + Frontend + Seeds + E2E"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Limpar portas antes de começar
cleanup

# 1. Seeds
echo "▶ 1/5 Seeds (multi-tenant + perfis completos)..."
cd "$ROOT/backend"
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts
echo "   OK"
echo ""

# 2. Iniciar backend
echo "▶ 2/5 Iniciar backend (porta 3001)..."
cd "$ROOT/backend"
npm run dev &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo ""

# 3. Iniciar frontend
echo "▶ 3/5 Iniciar frontend (porta 8080)..."
cd "$ROOT/frontend"
E2E_HOST=127.0.0.1 npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo ""

# 4. Esperar pelos servidores
echo "▶ 4/5 Aguardar backend e frontend..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  BACKEND_OK=false
  FRONTEND_OK=false
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null | grep -q 200 && BACKEND_OK=true
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 2>/dev/null | grep -qE "200|304" && FRONTEND_OK=true
  if $BACKEND_OK && $FRONTEND_OK; then
    echo "   Backend OK | Frontend OK"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "   ERRO: Timeout à espera dos servidores."
    echo "   Backend: $BACKEND_OK | Frontend: $FRONTEND_OK"
    exit 1
  fi
  sleep 2
done
echo ""

# 5. Executar testes E2E (sem Playwright iniciar o servidor)
echo "▶ 5/5 Testes E2E full-system..."
cd "$ROOT/frontend"
npx playwright install chromium 2>/dev/null || true
set +e  # não sair ao falhar - capturar exit code
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:full-system:no-server
TEST_EXIT=$?
set -e

echo ""
if [ "$TEST_EXIT" -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ TESTE E2E FULL-SYSTEM CONCLUÍDO COM SUCESSO"
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ❌ TESTE E2E FALHOU (exit code: $TEST_EXIT)"
  echo "═══════════════════════════════════════════════════════════════"
fi

exit "$TEST_EXIT"
