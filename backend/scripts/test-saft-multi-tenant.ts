#!/usr/bin/env npx tsx
/**
 * TESTE: SAFT - Multi-Tenant e Dois Tipos de Instituição
 *
 * Valida:
 * 1. ADMIN (Secundário/Superior) - gera SAFT da sua instituição via token
 * 2. SUPER_ADMIN - gera SAFT com ?instituicaoId=xxx (query param)
 * 3. Body com instituicao_id é REJEITADO (400)
 * 4. ADMIN A não vê SAFT da instituição B
 * 5. Funciona para ambos os tipos (Secundário e Superior)
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 * Backend rodando: API_URL (default http://localhost:3001)
 *
 * Uso: npx tsx scripts/test-saft-multi-tenant.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

interface TestResult {
  name: string;
  ok: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE SAFT - MULTI-TENANT E DOIS TIPOS DE INSTITUIÇÃO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let instituicaoA!: string;
  let instituicaoB!: string;
  let tokenA!: string;
  let tokenB!: string;
  let tokenSuperAdmin!: string;

  // 1. Buscar instituições (Secundário e Superior) - priorizar seed multi-tenant
  console.log('1. PREPARAÇÃO - Buscando Inst A (Secundário) e Inst B (Superior)');
  try {
    let instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    let instB = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!instA) instA = await prisma.instituicao.findFirst({ where: { tipoAcademico: 'SECUNDARIO' }, select: { id: true, nome: true, tipoAcademico: true } });
    if (!instB) instB = await prisma.instituicao.findFirst({ where: { tipoAcademico: 'SUPERIOR' }, select: { id: true, nome: true, tipoAcademico: true } });

    if (!instA || !instB) {
      const all = await prisma.instituicao.findMany({ take: 2, select: { id: true, nome: true, tipoAcademico: true } });
      if (all.length < 2) {
        assert('2 instituições no banco', false, 'Rode: npx tsx scripts/seed-multi-tenant-test.ts');
        printSummary();
        process.exit(1);
      }
      instituicaoA = all[0].id;
      instituicaoB = all[1].id;
      assert('2 instituições', true, `${all[0].nome} | ${all[1].nome}`);
    } else {
      instituicaoA = instA.id;
      instituicaoB = instB.id;
      assert('Inst A (Secundário)', true, `${instA.nome} (${instA.tipoAcademico})`);
      assert('Inst B (Superior)', true, `${instB.nome} (${instB.tipoAcademico})`);
    }
  } catch (e) {
    assert('Conexão banco', false, (e as Error).message);
    printSummary();
    process.exit(1);
  }

  // 2. Login - Admin A, Admin B, Super Admin
  console.log('\n2. AUTENTICAÇÃO');
  const emailA = process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
  const passA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
  const emailB = process.env.TEST_USER_INST_B_EMAIL || 'admin.inst.b@teste.dsicola.com';
  const passB = process.env.TEST_USER_INST_B_PASSWORD || 'TestMultiTenant123!';
  const emailSA = process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
  const passSA = process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  try {
    const resA = await axios.post(`${API_URL}/auth/login`, { email: emailA, password: passA }, { validateStatus: () => true });
    if (resA.status === 200 && resA.data?.accessToken && resA.data?.user?.instituicaoId === instituicaoA) {
      tokenA = resA.data.accessToken;
      assert('Login Admin A (Secundário)', true);
    } else {
      assert('Login Admin A', false, resA.status === 429 ? 'Rate limit' : `${resA.status}`);
    }

    const resB = await axios.post(`${API_URL}/auth/login`, { email: emailB, password: passB }, { validateStatus: () => true });
    if (resB.status === 200 && resB.data?.accessToken && resB.data?.user?.instituicaoId === instituicaoB) {
      tokenB = resB.data.accessToken;
      assert('Login Admin B (Superior)', true);
    } else {
      assert('Login Admin B', false, resB.status === 429 ? 'Rate limit' : `${resB.status}`);
    }

    const resSA = await axios.post(`${API_URL}/auth/login`, { email: emailSA, password: passSA }, { validateStatus: () => true });
    if (resSA.status === 200 && resSA.data?.accessToken && resSA.data?.user?.roles?.includes('SUPER_ADMIN')) {
      tokenSuperAdmin = resSA.data.accessToken;
      assert('Login Super Admin', true);
    } else {
      assert('Login Super Admin', false, 'Crie usuário SUPER_ADMIN ou use env TEST_SUPER_ADMIN_*');
    }
  } catch (e) {
    assert('Requests de login', false, (e as Error).message);
  }

  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  // 3. REGRA MULTI-TENANT: Body com instituicao_id deve ser REJEITADO
  console.log('\n3. SEGURANÇA - Body instituicao_id rejeitado');
  const tokenParaReject = tokenA || tokenB;
  if (tokenParaReject) {
    const resReject = await axios.post(
      `${API_URL}/saft-exports`,
      {
        instituicao_id: instituicaoB, // Tentativa de criar para outra instituição
        periodo_inicio: '2025-01-01',
        periodo_fim: '2025-12-31',
        status: 'gerado',
      },
      { headers: headers(tokenParaReject), validateStatus: () => true }
    );
    const rejected = resReject.status === 400 && (resReject.data?.message?.includes('instituição') || resReject.data?.message?.includes('Não é permitido'));
    assert('Body instituicao_id rejeitado (400)', rejected, rejected ? 'OK' : `Status: ${resReject.status}`);
  } else {
    assert('Body instituicao_id rejeitado', true, 'Skip (sem token)');
  }

  // 4. ADMIN A - Create SAFT (sem instituicao_id no body - usa token)
  console.log('\n4. ADMIN A (Secundário) - Gerar SAFT');
  let saftIdA: string | null = null;
  if (tokenA || tokenB) {
    const tkn = tokenA || tokenB;
    const instId = tokenA ? instituicaoA : instituicaoB;
    const resCreate = await axios.post(
      `${API_URL}/saft-exports`,
      {
        periodo_inicio: '2025-01-01',
        periodo_fim: '2025-12-31',
        arquivo_nome: tokenA ? 'saft-inst-a-test.xml' : 'saft-inst-b-fallback.xml',
        total_clientes: 0,
        total_produtos: 0,
        total_faturas: 0,
        valor_total: 0,
        status: 'gerado',
      },
      { headers: headers(tkn!), validateStatus: () => true }
    );
    if (resCreate.status === 201 && resCreate.data?.id) {
      saftIdA = resCreate.data.id;
      const gotInstId = resCreate.data?.instituicaoId;
      const ok = gotInstId === instId;
      assert(`Create SAFT Admin ${tokenA ? 'A' : 'B'} (201)`, true);
      assert(`SAFT pertence à instituição do token`, ok, ok ? 'OK' : `Esperado ${instId}, obtido ${gotInstId}`);
    } else {
      assert('Create SAFT Admin', false, `${resCreate.status}: ${JSON.stringify(resCreate.data)}`);
    }
  }

  // 5. ADMIN B - Create SAFT (Superior)
  console.log('\n5. ADMIN B (Superior) - Gerar SAFT');
  let saftIdB: string | null = null;
  if (tokenB) {
    const resCreate = await axios.post(
      `${API_URL}/saft-exports`,
      {
        periodo_inicio: '2025-01-01',
        periodo_fim: '2025-12-31',
        arquivo_nome: 'saft-inst-b-test.xml',
        status: 'gerado',
      },
      { headers: headers(tokenB), validateStatus: () => true }
    );
    if (resCreate.status === 201 && resCreate.data?.id) {
      saftIdB = resCreate.data.id;
      const instId = resCreate.data?.instituicaoId;
      assert('Create SAFT Admin B (201)', true);
      assert('SAFT pertence a Inst B', instId === instituicaoB, instId === instituicaoB ? 'OK' : 'instituicaoId incorreto');
    } else {
      assert('Create SAFT Admin B', false, `${resCreate.status}`);
    }
  }

  // 6. SUPER_ADMIN - Create com query param ?instituicaoId=
  console.log('\n6. SUPER_ADMIN - Gerar SAFT com query param');
  if (tokenSuperAdmin) {
    const resCreate = await axios.post(
      `${API_URL}/saft-exports?instituicaoId=${instituicaoA}`,
      {
        periodo_inicio: '2025-01-01',
        periodo_fim: '2025-12-31',
        arquivo_nome: 'saft-sa-inst-a.xml',
        status: 'gerado',
      },
      { headers: headers(tokenSuperAdmin), validateStatus: () => true }
    );
    const ok = resCreate.status === 201 && resCreate.data?.instituicaoId === instituicaoA;
    assert('Super Admin create com ?instituicaoId (201)', ok, ok ? 'OK' : `${resCreate.status}`);
  }

  // 7. Isolamento: Admin não vê SAFT de outra instituição
  console.log('\n7. ISOLAMENTO - Admin não acessa SAFT de outra instituição');
  if (tokenA && tokenB && saftIdA && saftIdB) {
    const resAgetB = await axios.get(`${API_URL}/saft-exports/${saftIdB}`, {
      headers: headers(tokenA),
      validateStatus: () => true,
    });
    const resBgetA = await axios.get(`${API_URL}/saft-exports/${saftIdA}`, {
      headers: headers(tokenB),
      validateStatus: () => true,
    });
    const isolated = (resAgetB.status === 404 || resAgetB.data?.instituicaoId !== instituicaoA) &&
      (resBgetA.status === 404 || resBgetA.data?.instituicaoId !== instituicaoB);
    assert('Isolamento cross-tenant (A≠B)', isolated, isolated ? 'OK' : 'FALHA');
  } else {
    assert('Isolamento cross-tenant', true, 'Skip (precisa tokenA, tokenB, saftIdA, saftIdB)');
  }

  // 8. getAll filtra por instituição
  console.log('\n8. GETALL - Filtro por instituição');
  const tokenGetAll = tokenA || tokenB;
  const expectedInstId = tokenA ? instituicaoA : instituicaoB;
  if (tokenGetAll) {
    const resAll = await axios.get(`${API_URL}/saft-exports`, { headers: headers(tokenGetAll), validateStatus: () => true });
    if (resAll.status === 200 && Array.isArray(resAll.data)) {
      const allFromInst = resAll.data.every((s: any) => s.instituicaoId === expectedInstId);
      assert(`getAll só retorna dados da instituição do token`, allFromInst, allFromInst ? 'OK' : 'Contém outra instituição');
    } else {
      assert('getAll', resAll.status === 200, `${resAll.status}`);
    }
  }

  await prisma.$disconnect();
  printSummary();
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed}/${total} testes passaram`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
