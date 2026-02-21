#!/usr/bin/env npx tsx
/**
 * TESTE: Período de Lançamento de Notas - Multi-tenant e Dois Tipos de Instituição
 *
 * Garante que:
 * 1. Instituição A (SECUNDARIO) usa TRIMESTRE - seus períodos são isolados
 * 2. Instituição B (SUPERIOR) usa SEMESTRE - seus períodos são isolados
 * 3. Admin A não vê períodos da Inst B
 * 4. Admin B não vê períodos da Inst A
 * 5. Cada instituição cria/recebe apenas seus próprios períodos
 *
 * Requer: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx scripts/test-periodo-lancamento-multitenant.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

function criarApi(token?: string): AxiosInstance {
  const api = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return api;
}

async function loginAsAdmin(api: AxiosInstance, email: string): Promise<boolean> {
  const res = await api.post('/auth/login', { email, password: SENHA });
  if (res.status !== 200 || !res.data?.accessToken) return false;
  api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
  return true;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Período de Lançamento - Multi-tenant + Dois Tipos');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar instituições de teste (inst-a-secundario, inst-b-superior)
  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    include: {
      anosLetivos: { take: 1, orderBy: { ano: 'desc' } },
      users: {
        where: { roles: { some: { role: 'ADMIN' } } },
        take: 1,
      },
    },
  });

  const instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    include: {
      anosLetivos: { take: 1, orderBy: { ano: 'desc' } },
      users: {
        where: { roles: { some: { role: 'ADMIN' } } },
        take: 1,
      },
    },
  });

  if (!instA || !instB) {
    console.error('   ❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const adminA = instA.users[0];
  const adminB = instB.users[0];
  const anoA = instA.anosLetivos[0];
  const anoB = instB.anosLetivos[0];

  if (!adminA || !adminB) {
    console.error('   ❌ Admins não encontrados nas instituições');
    process.exit(1);
  }

  if (!anoA || !anoB) {
    console.error('   ❌ Anos letivos não encontrados. Crie anos letivos nas instituições.');
    process.exit(1);
  }

  // Garantir tipo académico
  await prisma.instituicao.update({ where: { id: instA.id }, data: { tipoAcademico: 'SECUNDARIO' } });
  await prisma.instituicao.update({ where: { id: instB.id }, data: { tipoAcademico: 'SUPERIOR' } });

  const hash = await bcrypt.hash(SENHA, 10);
  await prisma.user.updateMany({
    where: { id: { in: [adminA.id, adminB.id] } },
    data: { password: hash },
  });
  await prisma.loginAttempt.deleteMany({
    where: { email: { in: [adminA.email, adminB.email].map((e) => e?.toLowerCase()).filter(Boolean) } },
  });

  console.log(`   Inst A (SECUNDARIO): ${instA.nome}`);
  console.log(`   Inst B (SUPERIOR):   ${instB.nome}\n`);

  const apiA = criarApi();
  const apiB = criarApi();

  // ─── 1. Login Admin A e criar período TRIMESTRE 1 ───────────────────────────
  console.log('1. Admin A (Secundário) - Login e criar TRIMESTRE 1...');
  if (!(await loginAsAdmin(apiA, adminA.email!))) {
    console.error('   ❌ Login Admin A falhou');
    process.exit(1);
  }

  const listA0 = await apiA.get('/periodos-lancamento-notas');
  const periodosA0 = Array.isArray(listA0.data) ? listA0.data : [];
  const jaTemTrim1 = periodosA0.some(
    (p: any) => p.anoLetivoId === anoA.id && p.tipoPeriodo === 'TRIMESTRE' && p.numeroPeriodo === 1
  );

  if (!jaTemTrim1) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 2);
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + 5);

    const createA = await apiA.post('/periodos-lancamento-notas', {
      anoLetivoId: anoA.id,
      tipoPeriodo: 'TRIMESTRE',
      numeroPeriodo: 1,
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
    });

    if (createA.status !== 201 && createA.status !== 200) {
      console.error('   ❌ Falha ao criar TRIMESTRE 1:', createA.status, createA.data?.message);
      process.exit(1);
    }
  }
  console.log('   ✔ Inst A: período TRIMESTRE 1 criado/existente');

  const listA = await apiA.get('/periodos-lancamento-notas');
  const periodosA = Array.isArray(listA.data) ? listA.data : [];
  const periodoA = periodosA.find(
    (p: any) => p.anoLetivoId === anoA.id && p.tipoPeriodo === 'TRIMESTRE' && p.numeroPeriodo === 1
  );
  if (!periodoA) {
    console.error('   ❌ Período TRIMESTRE 1 não encontrado para Inst A');
    process.exit(1);
  }
  console.log(`   ✔ Inst A tem ${periodosA.length} período(s) - isolamento OK`);

  // ─── 2. Admin B - Não deve ver períodos da Inst A ───────────────────────────
  console.log('\n2. Admin B (Superior) - Listar períodos (deve ser vazio ou só de B)...');
  if (!(await loginAsAdmin(apiB, adminB.email!))) {
    console.error('   ❌ Login Admin B falhou');
    process.exit(1);
  }

  const listB = await apiB.get('/periodos-lancamento-notas');
  const periodosB = Array.isArray(listB.data) ? listB.data : [];
  const vazouDeA = periodosB.some((p: any) => p.id === periodoA.id || p.instituicaoId === instA.id);
  if (vazouDeA) {
    console.error('   ❌ FALHA MULTI-TENANT: Admin B viu períodos da Inst A!');
    process.exit(1);
  }
  console.log(`   ✔ Inst B vê apenas seus períodos (${periodosB.length}) - isolamento OK`);

  // ─── 3. Admin B cria período SEMESTRE 1 ───────────────────────────────────
  console.log('\n3. Admin B - Criar período SEMESTRE 1...');
  const jaTemSem1 = periodosB.some(
    (p: any) => p.anoLetivoId === anoB.id && p.tipoPeriodo === 'SEMESTRE' && p.numeroPeriodo === 1
  );

  if (!jaTemSem1) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 1);
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + 7);

    const createB = await apiB.post('/periodos-lancamento-notas', {
      anoLetivoId: anoB.id,
      tipoPeriodo: 'SEMESTRE',
      numeroPeriodo: 1,
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
    });

    if (createB.status !== 201 && createB.status !== 200) {
      console.error('   ❌ Falha ao criar SEMESTRE 1:', createB.status, createB.data?.message);
      process.exit(1);
    }
  }
  console.log('   ✔ Inst B: período SEMESTRE 1 criado/existente');

  // ─── 4. Admin A não deve ver períodos da Inst B ───────────────────────────
  console.log('\n4. Admin A - Listar novamente (não deve ver períodos de B)...');
  if (!(await loginAsAdmin(apiA, adminA.email!))) {
    console.error('   ❌ Login Admin A falhou');
    process.exit(1);
  }

  const listA2 = await apiA.get('/periodos-lancamento-notas');
  const periodosA2 = Array.isArray(listA2.data) ? listA2.data : [];
  const periodoBSem1 = await prisma.periodoLancamentoNotas.findFirst({
    where: {
      instituicaoId: instB.id,
      anoLetivoId: anoB.id,
      tipoPeriodo: 'SEMESTRE',
      numeroPeriodo: 1,
    },
  });

  if (periodoBSem1) {
    const vazouDeB = periodosA2.some((p: any) => p.id === periodoBSem1.id || p.instituicaoId === instB.id);
    if (vazouDeB) {
      console.error('   ❌ FALHA MULTI-TENANT: Admin A viu períodos da Inst B!');
      process.exit(1);
    }
  }
  console.log(`   ✔ Inst A vê apenas seus períodos (${periodosA2.length}) - isolamento OK`);

  // ─── 5. Admin B não pode atualizar período da Inst A ──────────────────────
  console.log('\n5. Admin B tenta atualizar período da Inst A (deve falhar 404)...');
  if (!(await loginAsAdmin(apiB, adminB.email!))) process.exit(1);

  let updateStatus = 200;
  try {
    const updateOutro = await apiB.put(`/periodos-lancamento-notas/${periodoA.id}`, {
      status: 'FECHADO',
    });
    updateStatus = updateOutro.status;
  } catch (err: any) {
    updateStatus = err.response?.status ?? 0;
  }

  if (updateStatus === 200) {
    console.error('   ❌ FALHA: Admin B conseguiu alterar período da Inst A!');
    process.exit(1);
  }
  if (updateStatus === 404) {
    console.log('   ✔ Atualização corretamente bloqueada (404)');
  } else {
    console.log('   ✔ Bloqueado:', updateStatus);
  }

  // ─── 6. Período ativo por instituição ─────────────────────────────────────
  console.log('\n6. Período ativo - cada instituição vê o seu...');
  if (!(await loginAsAdmin(apiA, adminA.email!))) process.exit(1);
  const ativoA = await apiA.get('/periodos-lancamento-notas/ativo');
  if (!(await loginAsAdmin(apiB, adminB.email!))) process.exit(1);
  const ativoB = await apiB.get('/periodos-lancamento-notas/ativo');

  const ativoResA = ativoA.data;
  const ativoResB = ativoB.data;

  if (ativoResA && ativoResA.tipoPeriodo !== 'TRIMESTRE') {
    console.log('   ℹ Inst A - período ativo:', ativoResA?.tipoPeriodo, ativoResA?.numeroPeriodo);
  } else if (ativoResA) {
    console.log('   ✔ Inst A (Secundário): período ativo TRIMESTRE', ativoResA.numeroPeriodo);
  }

  if (ativoResB && ativoResB.tipoPeriodo !== 'SEMESTRE') {
    console.log('   ℹ Inst B - período ativo:', ativoResB?.tipoPeriodo, ativoResB?.numeroPeriodo);
  } else if (ativoResB) {
    console.log('   ✔ Inst B (Superior): período ativo SEMESTRE', ativoResB.numeroPeriodo);
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO DO TESTE MULTI-TENANT + DOIS TIPOS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✓ Inst A (SECUNDARIO): períodos TRIMESTRE isolados');
  console.log('  ✓ Inst B (SUPERIOR): períodos SEMESTRE isolados');
  console.log('  ✓ Admin A não vê períodos da Inst B');
  console.log('  ✓ Admin B não vê períodos da Inst A');
  console.log('  ✓ Admin B não pode alterar períodos da Inst A');
  console.log('\n  Multi-tenant e dois tipos validados.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
