#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO - Criar Instituição + Criar Admin (via API, sem Playwright)
 *
 * Simula o fluxo E2E: Super Admin cria instituição e depois cria admin.
 * Usa apenas chamadas HTTP à API - não precisa de browser.
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-instituicao-admin-fluxo.ts
 *      ou: TEST_SUPER_ADMIN_EMAIL=... TEST_SUPER_ADMIN_PASSWORD=... npx tsx scripts/test-instituicao-admin-fluxo.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO: Criar Instituição + Criar Admin (API)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}`);
  console.log(`Super Admin: ${SUPER_ADMIN_EMAIL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  const uniqueId = Date.now();
  const nomeInstituicao = `Instituição Teste API ${uniqueId}`;
  const subdominio = `e2e-api-${uniqueId}`;
  const emailContato = `contato-${uniqueId}@teste.dsicola.com`;
  const adminNome = `Admin Teste API ${uniqueId}`;
  const adminEmail = `admin-${uniqueId}@teste.dsicola.com`;
  const adminPassword = 'Admin@123';

  // ─── 1. LOGIN ─────────────────────────────────────────────────────────────────────────────
  console.log('1. LOGIN como Super Admin...');
  const loginRes = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('❌ Super Admin precisa trocar senha. Execute: npm run db:seed');
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log('   ✅ Login OK\n');

  // ─── 2. CRIAR INSTITUIÇÃO ──────────────────────────────────────────────────────────────────
  console.log('2. CRIAR INSTITUIÇÃO (POST /instituicoes)...');
  const createInstRes = await api.post('/instituicoes', {
    nome: nomeInstituicao,
    subdominio,
    emailContato,
    tipoAcademico: 'SUPERIOR',
  });

  if (createInstRes.status !== 201 || !createInstRes.data?.id) {
    console.error('❌ Falha ao criar instituição:', createInstRes.data?.message || createInstRes.statusText);
    process.exit(1);
  }

  const instituicaoId = createInstRes.data.id;
  console.log(`   ✅ Instituição criada: ${nomeInstituicao} (${instituicaoId})\n`);

  // ─── 3. CRIAR ADMIN ────────────────────────────────────────────────────────────────────────
  console.log('3. CRIAR ADMIN (POST /onboarding/instituicao/admin)...');
  const createAdminRes = await api.post('/onboarding/instituicao/admin', {
    instituicaoId,
    emailAdmin: adminEmail,
    senhaAdmin: adminPassword,
    nomeAdmin: adminNome,
  });

  if (createAdminRes.status !== 201 || !createAdminRes.data?.admin?.id) {
    console.error('❌ Falha ao criar admin:', createAdminRes.data?.message || createAdminRes.statusText);
    process.exit(1);
  }

  console.log(`   ✅ Admin criado: ${adminNome} (${adminEmail})\n`);

  // ─── 4. VERIFICAR ADMIN PODE FAZER LOGIN ──────────────────────────────────────────────────
  console.log('4. VERIFICAR login do admin...');
  const adminLoginRes = await axios.post(
    `${API_URL}/auth/login`,
    { email: adminEmail, password: adminPassword },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000, validateStatus: () => true }
  );

  if (adminLoginRes.status !== 200 || !adminLoginRes.data?.accessToken) {
    console.error('❌ Admin não conseguiu fazer login:', adminLoginRes.data?.message || adminLoginRes.statusText);
    process.exit(1);
  }

  console.log('   ✅ Admin fez login com sucesso\n');

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ✅ FLUXO COMPLETO OK: Instituição + Admin criados e admin autenticado');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
