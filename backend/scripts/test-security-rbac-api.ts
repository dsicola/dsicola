#!/usr/bin/env npx tsx
/**
 * TESTE: RBAC via API - Verifica que acesso não autorizado retorna 403
 *
 * Cenários:
 * 1. ALUNO com token tenta acessar rota ADMIN-only → 403
 * 2. PROFESSOR tenta acessar rota SUPER_ADMIN-only → 403
 * 3. ADMIN com token acessa rota permitida → 200
 * 4. Sem token em rota protegida → 401
 *
 * Pré-requisito: Backend rodando, seeds: seed-multi-tenant-test + seed-perfis-completos
 * Uso: npm run test:security-rbac-api
 */
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

const CREDS = {
  aluno: {
    email: process.env.TEST_ALUNO_INST_A_EMAIL || 'aluno.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  professor: {
    email: process.env.TEST_PROF_INST_A_EMAIL || 'prof.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  admin: {
    email: process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
};

async function login(email: string, password: string): Promise<string | null> {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password }, {
    validateStatus: () => true,
    timeout: 10000,
  });
  return res.status === 200 ? res.data?.accessToken : null;
}

async function apiGet(url: string, token?: string) {
  return axios.get(`${API_URL}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 5000,
  });
}

async function apiPost(url: string, data: object, token?: string) {
  return axios.post(`${API_URL}${url}`, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 5000,
  });
}

interface Assertion {
  name: string;
  ok: boolean;
  details?: string;
}

const results: Assertion[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE RBAC API - Acesso não autorizado deve retornar 401/403');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 0. Backend disponível
  try {
    await axios.get(`${API_URL}/health`, { timeout: 3000 });
  } catch {
    console.log('  ✖ Backend não disponível em', API_URL);
    console.log('    Inicie o backend e rode: npx tsx scripts/test-security-rbac-api.ts\n');
    process.exit(1);
  }

  // 1. Sem token → 401
  console.log('1. ROTAS PROTEGIDAS SEM TOKEN');
  const noTokenRes = await apiGet('/users');
  assert('Sem token retorna 401', noTokenRes.status === 401, `Status: ${noTokenRes.status}`);

  // 2. ALUNO tenta rota ADMIN-only
  console.log('\n2. ALUNO ACESSANDO ROTA ADMIN-ONLY');
  const alunoToken = await login(CREDS.aluno.email, CREDS.aluno.password);
  if (!alunoToken) {
    assert('Login ALUNO', false, 'Credenciais inválidas - rode seed-multi-tenant-test');
  } else {
    const alunoUsersRes = await apiGet('/users', alunoToken);
    assert('ALUNO em GET /users retorna 403', alunoUsersRes.status === 403, `Status: ${alunoUsersRes.status}`);

    const alunoStatsRes = await apiGet('/stats/admin', alunoToken);
    assert('ALUNO em GET /stats/admin retorna 403', alunoStatsRes.status === 403, `Status: ${alunoStatsRes.status}`);

    // GET /configuracoes-instituicao é permitido para ALUNO (leitura de nome/logo/cores para dashboard)
    const alunoConfigRes = await apiGet('/configuracoes-instituicao', alunoToken);
    assert('ALUNO em GET /configuracoes-instituicao retorna 200 (leitura permitida)', alunoConfigRes.status === 200, `Status: ${alunoConfigRes.status}`);
  }

  // 3. PROFESSOR tenta rota SUPER_ADMIN-only (POST /planos - criar plano comercial)
  console.log('\n3. PROFESSOR ACESSANDO ROTA SUPER_ADMIN-ONLY');
  const profToken = await login(CREDS.professor.email, CREDS.professor.password);
  if (!profToken) {
    assert('Login PROFESSOR', false, 'Credenciais inválidas');
  } else {
    const profPlanosRes = await apiPost('/planos', { nome: 'Teste', limiteAlunos: 100 }, profToken);
    assert('PROFESSOR em POST /planos retorna 403', profPlanosRes.status === 403, `Status: ${profPlanosRes.status}`);
  }

  // 4. ADMIN acessa rotas permitidas
  console.log('\n4. ADMIN ACESSANDO ROTAS PERMITIDAS');
  const adminToken = await login(CREDS.admin.email, CREDS.admin.password);
  if (!adminToken) {
    assert('Login ADMIN', false, 'Credenciais inválidas');
  } else {
    const adminStatsRes = await apiGet('/stats/admin', adminToken);
    assert('ADMIN em GET /stats/admin retorna 200', adminStatsRes.status === 200, `Status: ${adminStatsRes.status}`);

    const adminConfigRes = await apiGet('/configuracoes-instituicao', adminToken);
    assert('ADMIN em GET /configuracoes-instituicao retorna 200', adminConfigRes.status === 200, `Status: ${adminConfigRes.status}`);
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`  ${passed}/${results.length} asserções passaram.\n`);

  if (failed.length > 0) {
    console.log('  Itens que falharam:');
    failed.forEach((r) => console.log(`    - ${r.name}${r.details ? ` (${r.details})` : ''}`));
    console.log('\n  ❌ RBAC API - Falhas detectadas. Verifique middlewares de autorização.\n');
    process.exit(1);
  }

  console.log('  ✅ RBAC API - Acesso não autorizado corretamente bloqueado (401/403).\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
