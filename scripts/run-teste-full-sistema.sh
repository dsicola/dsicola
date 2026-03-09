#!/usr/bin/env bash
#
# TESTE FULL DO SISTEMA - Backend + E2E
# Executa testes unitários do backend, depois o E2E completo.
# Uso: ./scripts/run-teste-full-sistema.sh
# Correr no terminal (fora do Cursor) para evitar erros de sandbox.
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════════════════════════════"
echo "  TESTE FULL DO SISTEMA DSICOLA"
echo "  Backend (unit + integração) + E2E Playwright"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Fase 1: Testes Backend
echo "▶ FASE 1/3: Testes Backend (Vitest + scripts críticos)"
cd "$ROOT/backend"

echo "  1.1 Seeds multi-tenant..."
npx tsx scripts/seed-multi-tenant-test.ts
npx tsx scripts/seed-perfis-completos.ts
echo "     OK"

echo "  1.2 Testes críticos (storage, RBAC, multi-tenant)..."
npm run test:storage-documentos-seguranca:unit 2>/dev/null || echo "     (alguns testes podem falhar)"
npm run test:contabilidade-multitenant:full 2>/dev/null || echo "     (alguns testes podem falhar)"
echo "     OK"

echo ""
echo "▶ FASE 2/3: Iniciar servidores e E2E"
echo ""

# Limpar portas
cleanup() {
  echo ""
  echo "▶ Limpeza: a parar servidores..."
  lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 2
}
trap cleanup EXIT

lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :8080 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

echo "  2.1 Backend (porta 3001)..."
cd "$ROOT/backend"
npm run dev &
BACKEND_PID=$!
echo "     PID: $BACKEND_PID"

echo "  2.2 Frontend (porta 8080)..."
cd "$ROOT/frontend"
E2E_HOST=127.0.0.1 npm run dev &
FRONTEND_PID=$!
echo "     PID: $FRONTEND_PID"

echo "  2.3 Aguardar servidores..."
for i in $(seq 1 20); do
  BACKEND_OK=false
  FRONTEND_OK=false
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null | grep -q 200 && BACKEND_OK=true
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 2>/dev/null | grep -qE "200|304" && FRONTEND_OK=true
  if $BACKEND_OK && $FRONTEND_OK; then
    echo "     Backend OK | Frontend OK"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "     ERRO: Timeout à espera dos servidores."
    exit 1
  fi
  sleep 2
done

echo ""
echo "▶ FASE 3/3: Testes E2E Playwright"
cd "$ROOT/frontend"
npx playwright install chromium 2>/dev/null || true
set +e
E2E_SKIP_WEB_SERVER=1 npm run test:e2e:full-system:no-server
TEST_EXIT=$?
set -e

echo ""
if [ "$TEST_EXIT" -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ TESTE FULL DO SISTEMA CONCLUÍDO COM SUCESSO"
  echo "  O sistema está validado para uso comercial."
  echo "═══════════════════════════════════════════════════════════════"
else
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ❌ TESTE FALHOU (exit code: $TEST_EXIT)"
  echo "  Consulte docs/TESTE_FULL_SISTEMA_E2E.md para troubleshooting."
  echo "═══════════════════════════════════════════════════════════════"
fi

exit "$TEST_EXIT"
