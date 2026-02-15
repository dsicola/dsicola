#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo de planos e limites - Secundário e Superior
 *
 * Cria duas instituições (uma SECUNDÁRIO, uma SUPERIOR), cada uma com plano
 * de limite baixo, e valida:
 * - Cadastro de alunos até o limite
 * - Tolerância configurável (10% - ex: 5 alunos permite até 6)
 * - Bloqueio ao exceder limite + tolerância
 * - Candidatura: aprovação bloqueada no limite
 * - Stats/uso-instituicao retorna dados corretos
 *
 * IMPORTANTE: Usa dados isolados (subdomínio/email únicos) para não afetar produção.
 * Requer: Backend rodando (localhost:3001) e seed-planos-comerciais executado.
 *
 * Uso: npx tsx scripts/test-fluxo-planos-secundario-superior.ts
 *
 * PRÉ-REQUISITOS:
 * - Backend rodando (npm run dev)
 * - Migração 20260215100000 aplicada (npx prisma migrate deploy)
 * - Cliente Prisma regenerado (npx prisma generate)
 * - Reinicie o backend após migrações para carregar o novo cliente
 */
import axios from 'axios';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

const TS = Date.now();
const PREFIX = `planos-${TS}`;

function createApi(token?: string) {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    timeout: 20000,
    validateStatus: () => true,
  });
}

interface TestResult {
  step: string;
  ok: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function assert(step: string, ok: boolean, detail?: string) {
  results.push({ step, ok, detail });
  const icon = ok ? '✓' : '✖';
  console.log('  ' + icon + ' ' + step + (detail ? ' - ' + detail : ''));
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  🎓 TESTE: FLUXO COMPLETO PLANOS SECUNDÁRIO + SUPERIOR');
  console.log('  Planos, limites, tolerância 10%, bloqueio e stats');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}`);
  console.log(`Prefix: ${PREFIX}\n`);

  const api = createApi();

  // ─── 1. Planos de teste (limite 5, tolerância 10% = até 6 alunos) ─────────────────
  console.log('1. Criando planos de teste (limite 5 alunos)...');
  let planoSec: { id: string; nome: string; limiteAlunos: number | null };
  let planoSup: { id: string; nome: string; limiteAlunos: number | null };

  planoSec = await prisma.plano.create({
    data: {
      nome: `Teste Sec 5 ${PREFIX}`,
      descricao: 'Plano teste Secundário limite 5',
      tipoAcademico: 'SECUNDARIO',
      valorMensal: 1000,
      valorAnual: 10000,
      limiteAlunos: 5,
      ativo: true,
    },
  });
  assert('Plano Secundário criado', !!planoSec.id, `limite=${planoSec.limiteAlunos}`);

  planoSup = await prisma.plano.create({
    data: {
      nome: `Teste Sup 5 ${PREFIX}`,
      descricao: 'Plano teste Superior limite 5',
      tipoAcademico: 'SUPERIOR',
      valorMensal: 2000,
      valorAnual: 20000,
      limiteAlunos: 5,
      ativo: true,
    },
  });
  assert('Plano Superior criado', !!planoSup.id, `limite=${planoSup.limiteAlunos}`);

  // ─── 2. Login SUPER_ADMIN ───────────────────────────────────────────────────────
  console.log('\n2. Login SUPER_ADMIN...');
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    assert('Login SUPER_ADMIN', false, loginSuper.data?.message || 'Sem token');
    throw new Error('Falha no login SUPER_ADMIN');
  }
  const apiSuper = createApi(loginSuper.data.accessToken);
  assert('Login SUPER_ADMIN', true);

  // ─── 3. Criar instituição SECUNDÁRIO ──────────────────────────────────────────────
  console.log('\n3. Criar instituição SECUNDÁRIO...');
  const subSec = `sec-${PREFIX}`.slice(0, 50);
  const emailSec = `admin.sec.${PREFIX}@teste.dsicola.com`;
  const nomeSec = `Inst Secundário ${PREFIX}`;

  const onboardingSec = await apiSuper.post('/onboarding/instituicao', {
    nomeInstituicao: nomeSec,
    subdominio: subSec,
    tipoAcademico: 'SECUNDARIO',
    emailContato: emailSec,
    emailAdmin: emailSec,
    senhaAdmin: 'TestePlanos@123',
    nomeAdmin: 'Admin Secundário Teste',
    planoId: planoSec.id,
  });

  if (onboardingSec.status !== 201 || !onboardingSec.data?.instituicao?.id) {
    assert('Onboarding Secundário', false, onboardingSec.data?.message || JSON.stringify(onboardingSec.data));
    throw new Error('Falha ao criar instituição Secundária');
  }
  const instSecId = onboardingSec.data.instituicao.id;
  assert('Instituição Secundário criada', true, instSecId);

  // ParametrosSistema com tolerância 10% (garante que middleware aplique limite efetivo)
  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: instSecId },
    create: { instituicaoId: instSecId, toleranciaPercentualLimiteAlunos: 10 },
    update: { toleranciaPercentualLimiteAlunos: 10 },
  });

  // ─── 4. Criar instituição SUPERIOR ───────────────────────────────────────────────
  console.log('\n4. Criar instituição SUPERIOR...');
  const subSup = `sup-${PREFIX}`.slice(0, 50);
  const emailSup = `admin.sup.${PREFIX}@teste.dsicola.com`;
  const nomeSup = `Inst Superior ${PREFIX}`;

  const onboardingSup = await apiSuper.post('/onboarding/instituicao', {
    nomeInstituicao: nomeSup,
    subdominio: subSup,
    tipoAcademico: 'SUPERIOR',
    emailContato: emailSup,
    emailAdmin: emailSup,
    senhaAdmin: 'TestePlanos@123',
    nomeAdmin: 'Admin Superior Teste',
    planoId: planoSup.id,
  });

  if (onboardingSup.status !== 201 || !onboardingSup.data?.instituicao?.id) {
    assert('Onboarding Superior', false, onboardingSup.data?.message || JSON.stringify(onboardingSup.data));
    throw new Error('Falha ao criar instituição Superior');
  }
  const instSupId = onboardingSup.data.instituicao.id;
  assert('Instituição Superior criada', true, instSupId);

  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: instSupId },
    create: { instituicaoId: instSupId, toleranciaPercentualLimiteAlunos: 10 },
    update: { toleranciaPercentualLimiteAlunos: 10 },
  });

  // ─── 5. Login como ADMIN de cada instituição ────────────────────────────────────
  console.log('\n5. Login como ADMIN das instituições...');
  const loginSec = await api.post('/auth/login', { email: emailSec, password: 'TestePlanos@123' });
  const loginSup = await api.post('/auth/login', { email: emailSup, password: 'TestePlanos@123' });

  if (loginSec.status !== 200 || !loginSec.data?.accessToken) {
    assert('Login ADMIN Secundário', false);
    throw new Error('Falha login admin Secundário');
  }
  if (loginSup.status !== 200 || !loginSup.data?.accessToken) {
    assert('Login ADMIN Superior', false);
    throw new Error('Falha login admin Superior');
  }
  const apiSec = createApi(loginSec.data.accessToken);
  const apiSup = createApi(loginSup.data.accessToken);
  assert('Login ADMIN Secundário e Superior', true);

  // ─── 6. Testar SECUNDÁRIO: criar 5 alunos (dentro do limite) ─────────────────────
  console.log('\n6. Secundário: criar 5 alunos (dentro do limite)...');
  for (let i = 1; i <= 5; i++) {
    const res = await apiSec.post('/users', {
      email: `aluno${i}.sec.${PREFIX}@teste.dsicola.com`,
      role: 'ALUNO',
      nome_completo: `Aluno Sec ${i}`,
      numero_identificacao: `SEC${TS}${i}`,
    });
    const ok = res.status === 201 || res.status === 200;
    assert(`Secundário: aluno ${i} criado`, ok, ok ? undefined : res.data?.message);
  }

  // ─── 7. Secundário: 6º aluno (dentro da tolerância 10%) ───────────────────────────
  console.log('\n7. Secundário: 6º aluno (tolerância 10% = limite efetivo 6)...');
  const res6Sec = await apiSec.post('/users', {
    email: `aluno6.sec.${PREFIX}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Sec 6',
    numero_identificacao: `SEC${TS}6`,
  });
  assert('Secundário: 6º aluno permitido (tolerância)', res6Sec.status === 201 || res6Sec.status === 200, res6Sec.data?.message);

  // ─── 8. Secundário: 7º aluno → DEVE BLOQUEAR ─────────────────────────────────────
  console.log('\n8. Secundário: 7º aluno → DEVE BLOQUEAR (403)...');
  const res7Sec = await apiSec.post('/users', {
    email: `aluno7.sec.${PREFIX}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Sec 7',
    numero_identificacao: `SEC${TS}7`,
  });
  const bloqueioSecOk = res7Sec.status === 403 && (res7Sec.data?.message || '').toLowerCase().includes('limite');
  assert('Secundário: 7º aluno bloqueado (403 + mensagem Limite)', bloqueioSecOk, res7Sec.data?.message);

  // ─── 9. Testar SUPERIOR: mesmo fluxo ──────────────────────────────────────────────
  console.log('\n9. Superior: criar 5 alunos + 6º (tolerância)...');
  for (let i = 1; i <= 5; i++) {
    const res = await apiSup.post('/users', {
      email: `aluno${i}.sup.${PREFIX}@teste.dsicola.com`,
      role: 'ALUNO',
      nome_completo: `Aluno Sup ${i}`,
      numero_identificacao: `SUP${TS}${i}`,
    });
    assert(`Superior: aluno ${i} criado`, res.status === 201 || res.status === 200);
  }
  const res6Sup = await apiSup.post('/users', {
    email: `aluno6.sup.${PREFIX}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Sup 6',
    numero_identificacao: `SUP${TS}6`,
  });
  assert('Superior: 6º aluno permitido (tolerância)', res6Sup.status === 201 || res6Sup.status === 200);

  console.log('\n10. Superior: 7º aluno → DEVE BLOQUEAR...');
  const res7Sup = await apiSup.post('/users', {
    email: `aluno7.sup.${PREFIX}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Sup 7',
    numero_identificacao: `SUP${TS}7`,
  });
  const bloqueioSupOk = res7Sup.status === 403 && (res7Sup.data?.message || '').toLowerCase().includes('limite');
  assert('Superior: 7º aluno bloqueado', bloqueioSupOk, res7Sup.data?.message);

  // ─── 11. Candidatura: aprovar no limite (Secundário já tem 6) → BLOQUEAR ─────────
  console.log('\n11. Candidatura: criar e tentar aprovar (limite atingido) → BLOQUEAR...');
  const candRes = await api.post('/candidaturas', {
    nomeCompleto: 'Candidato Teste Limite',
    email: `candidato.${PREFIX}@teste.dsicola.com`,
    numeroIdentificacao: `CAND${TS}`,
    telefone: '+244 900 000 001',
    dataNascimento: '2000-01-01',
    genero: 'M',
    morada: 'Rua Teste',
    cidade: 'Luanda',
    pais: 'Angola',
    instituicaoId: instSecId,
  });
  assert('Candidatura criada', candRes.status === 201 || candRes.status === 200);

  const candId = candRes.data?.id;
  if (candId) {
    const aprovarRes = await apiSec.post(`/candidaturas/${candId}/aprovar`);
    const candBloqueioOk = aprovarRes.status === 403 && (aprovarRes.data?.message || '').toLowerCase().includes('limite');
    assert('Aprovar candidatura bloqueada no limite', candBloqueioOk, aprovarRes.data?.message);
  }

  // ─── 12. Stats: uso-instituicao retorna dados corretos ───────────────────────────
  console.log('\n12. Stats: GET /stats/uso-instituicao para ambas instituições...');
  const statsSec = await apiSec.get('/stats/uso-instituicao');
  const statsSup = await apiSup.get('/stats/uso-instituicao');

  const statsSecOk = statsSec.status === 200 && statsSec.data?.alunos_atual === 6 && statsSec.data?.alunos_limite === 5;
  const statsSupOk = statsSup.status === 200 && statsSup.data?.alunos_atual === 6 && statsSup.data?.alunos_limite === 5;

  assert('Stats Secundário: alunos_atual=6, alunos_limite=5', statsSecOk,
    statsSec.data ? 'atual=' + statsSec.data.alunos_atual + ' limite=' + statsSec.data.alunos_limite : 'sem dados');
  assert('Stats Superior: alunos_atual=6, alunos_limite=5', statsSupOk,
    statsSup.data ? 'atual=' + statsSup.data.alunos_atual + ' limite=' + statsSup.data.alunos_limite : 'sem dados');

  // ─── 13. JWT contém tipoAcademico correto ─────────────────────────────────────────
  console.log('\n13. JWT: tipoAcademico correto para Secundário e Superior...');
  const payloadSec = JSON.parse(Buffer.from(loginSec.data.accessToken.split('.')[1], 'base64').toString());
  const payloadSup = JSON.parse(Buffer.from(loginSup.data.accessToken.split('.')[1], 'base64').toString());
  assert('JWT Secundário: tipoAcademico=SECUNDARIO', payloadSec.tipoAcademico === 'SECUNDARIO');
  assert('JWT Superior: tipoAcademico=SUPERIOR', payloadSup.tipoAcademico === 'SUPERIOR');

  // ─── 14. Nenhuma funcionalidade quebrada quando no limite ───────────────────────────
  console.log('\n14. Verificar que outras rotas funcionam com limite atingido...');
  const usersSec = await apiSec.get('/users?role=ALUNO');
  const usersSup = await apiSup.get('/users?role=ALUNO');
  assert('GET /users Secundário (no limite) retorna 6 alunos', usersSec.status === 200 && Array.isArray(usersSec.data) && usersSec.data.length === 6);
  assert('GET /users Superior (no limite) retorna 6 alunos', usersSup.status === 200 && Array.isArray(usersSup.data) && usersSup.data.length === 6);
  const statsAdminSec = await apiSec.get('/stats/admin');
  const statsAdminSup = await apiSup.get('/stats/admin');
  assert('GET /stats/admin Secundário funciona', statsAdminSec.status === 200 && statsAdminSec.data?.alunos === 6);
  assert('GET /stats/admin Superior funciona', statsAdminSup.status === 200 && statsAdminSup.data?.alunos === 6);

  // ─── RESUMO ──────────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const allPassed = passed === total;

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed}/${total} verificações OK`);
  if (allPassed) {
    console.log('  ✅ FLUXO COMPLETO OK: Secundário e Superior, planos, limites e tolerância funcionando.');
  } else {
    console.log('  ❌ FALHAS:');
    results.filter((r) => !r.ok).forEach((r) => console.log("     -", r.step, r.detail ? "(" + r.detail + ")" : ""));
  }
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
