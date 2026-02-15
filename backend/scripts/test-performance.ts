#!/usr/bin/env npx tsx
/**
 * TESTE DE PERFORMANCE — Dois Tipos de Instituição
 *
 * Requisitos mínimos de dados (seed-performance-test.ts):
 * - 200 alunos | 20 professores | 10 turmas | 500 registros financeiros
 *
 * O sistema NÃO PODE:
 * - Travar
 * - Ficar lento (cada request < 5s)
 * - Retornar erro 500
 *
 * Testa AMBAS as instituições (Secundário e Superior).
 *
 * Pré-requisitos:
 *   1. npx tsx scripts/seed-multi-tenant-test.ts
 *   2. npx tsx scripts/seed-performance-test.ts
 *   3. Backend rodando em http://localhost:3001
 *
 * Uso: npx tsx scripts/test-performance.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
const MAX_LATENCY_MS = 5000; // 5 segundos — falha se ultrapassar

interface Result {
  inst: string;
  tipo: 'SECUNDARIO' | 'SUPERIOR';
  endpoint: string;
  status: number;
  latenciaMs: number;
  ok: boolean;
  erro?: string;
}

const results: Result[] = [];
function log(r: Result) {
  const icon = r.ok ? '✅' : '❌';
  const lat = `${r.latenciaMs}ms`;
  const label = r.tipo === 'SECUNDARIO' ? '[SEC]' : '[SUP]';
  console.log(`  ${icon} ${label} ${r.endpoint} — status ${r.status} — ${lat}`);
}

async function request(
  api: AxiosInstance,
  method: 'get' | 'post',
  url: string,
  inst: string,
  tipo: 'SECUNDARIO' | 'SUPERIOR',
  params?: object,
  data?: object
): Promise<Result> {
  const start = Date.now();
  let res;
  try {
    if (method === 'get') {
      res = await api.get(url, { params, timeout: MAX_LATENCY_MS });
    } else {
      res = await api.post(url, data, { params, timeout: MAX_LATENCY_MS });
    }
  } catch (err: any) {
    const latenciaMs = Date.now() - start;
    const status = err.response?.status || 0;
    const msg = err.message || err.response?.data?.message || String(err);
    const r: Result = {
      inst,
      tipo,
      endpoint: `${method.toUpperCase()} ${url}`,
      status: status || 500,
      latenciaMs,
      ok: false,
      erro: msg,
    };
    results.push(r);
    log(r);
    return r;
  }

  const latenciaMs = Date.now() - start;
  const status = res.status;
  const is500 = status >= 500;
  const isLento = latenciaMs > MAX_LATENCY_MS;
  const ok = !is500 && !isLento;

  const r: Result = {
    inst,
    tipo,
    endpoint: `${method.toUpperCase()} ${url}`,
    status,
    latenciaMs,
    ok,
  };
  if (is500) r.erro = `Erro ${status} - não permitido`;
  if (isLento) r.erro = `Lento: ${latenciaMs}ms > ${MAX_LATENCY_MS}ms`;

  results.push(r);
  log(r);
  return r;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE PERFORMANCE — Dois Tipos de Instituição');
  console.log(`  Meta: 200 alunos | 20 professores | 10 turmas | 500 registros financeiros`);
  console.log('  Regras: Nenhum 500 | Nenhum travamento | Nenhuma lentidão (>5s)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: MAX_LATENCY_MS + 1000,
    validateStatus: () => true,
  });

  // Login Admin A e Admin B
  const loginA = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const loginB = await api.post('/auth/login', {
    email: 'admin.inst.b@teste.dsicola.com',
    password: SENHA,
  });

  const tokenA = loginA.data?.accessToken;
  const tokenB = loginB.data?.accessToken;

  if (!tokenA || !tokenB) {
    console.error('❌ Login falhou. Execute seed-multi-tenant-test.ts e seed-performance-test.ts');
    process.exit(1);
  }

  const apiA: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    timeout: MAX_LATENCY_MS + 1000,
    validateStatus: () => true,
  });

  const apiB: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    timeout: MAX_LATENCY_MS + 1000,
    validateStatus: () => true,
  });

  // ─── INSTITUIÇÃO A (SECUNDÁRIO) ─────────────────────────────────────────
  console.log('📘 Instituição A (Secundário)\n');

  await request(apiA, 'get', '/stats/admin', 'A', 'SECUNDARIO');
  await request(apiA, 'get', '/estudantes', 'A', 'SECUNDARIO', { page: '1', pageSize: '50' });
  await request(apiA, 'get', '/estudantes', 'A', 'SECUNDARIO', { page: '2', pageSize: '50' });
  await request(apiA, 'get', '/turmas', 'A', 'SECUNDARIO');
  await request(apiA, 'get', '/matriculas', 'A', 'SECUNDARIO', { page: '1', pageSize: '50' });
  await request(apiA, 'get', '/mensalidades', 'A', 'SECUNDARIO', { page: '1', pageSize: '50' });
  await request(apiA, 'get', '/mensalidades', 'A', 'SECUNDARIO', { page: '1', pageSize: '100' });
  await request(apiA, 'get', '/stats/recent-users', 'A', 'SECUNDARIO', { limit: '10' });

  // ─── INSTITUIÇÃO B (SUPERIOR) ───────────────────────────────────────────
  console.log('\n📗 Instituição B (Superior)\n');

  await request(apiB, 'get', '/stats/admin', 'B', 'SUPERIOR');
  await request(apiB, 'get', '/estudantes', 'B', 'SUPERIOR', { page: '1', pageSize: '50' });
  await request(apiB, 'get', '/estudantes', 'B', 'SUPERIOR', { page: '2', pageSize: '50' });
  await request(apiB, 'get', '/turmas', 'B', 'SUPERIOR');
  await request(apiB, 'get', '/matriculas', 'B', 'SUPERIOR', { page: '1', pageSize: '50' });
  await request(apiB, 'get', '/mensalidades', 'B', 'SUPERIOR', { page: '1', pageSize: '50' });
  await request(apiB, 'get', '/mensalidades', 'B', 'SUPERIOR', { page: '1', pageSize: '100' });
  await request(apiB, 'get', '/stats/recent-users', 'B', 'SUPERIOR', { limit: '10' });

  // ─── RESUMO ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const with500 = results.filter((r) => r.status >= 500);
  const lentos = results.filter((r) => r.latenciaMs > MAX_LATENCY_MS);
  const failed = results.filter((r) => !r.ok);

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - PERFORMANCE');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  ${passed}/${total} requisições OK`);
  if (with500.length > 0) {
    console.log(`  ❌ Erros 500: ${with500.length}`);
    with500.forEach((r) => console.log(`     [${r.tipo}] ${r.endpoint} → ${r.status}`));
  }
  if (lentos.length > 0) {
    console.log(`  ❌ Lentos (>${MAX_LATENCY_MS}ms): ${lentos.length}`);
    lentos.forEach((r) => console.log(`     [${r.tipo}] ${r.endpoint} → ${r.latenciaMs}ms`));
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  if (failed.length > 0) {
    console.log('❌ PERFORMANCE: Alguns testes falharam.');
    process.exit(1);
  }

  console.log('✅ PERFORMANCE: Todos os testes passaram para Secundário e Superior.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
