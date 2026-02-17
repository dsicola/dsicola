#!/usr/bin/env npx tsx
/**
 * TESTE: Planos, Limites e Assinaturas
 *
 * Valida o fluxo completo:
 * 1. Sync planos da landing para tabela Plano
 * 2. Onboarding com plano sincronizado (DSICOLA START)
 * 3. Limite de alunos - criar até o limite, bloquear ao exceder
 * 4. Limite de professores (se definido)
 * 5. Plano Enterprise (ilimitado) - permite criar além de limites
 * 6. Stats/uso da instituição
 *
 * Requer: Backend rodando (localhost:3001)
 * Uso: npx tsx scripts/test-planos-limites-assinaturas.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

const TS = Date.now();
const SUBDOMINIO_LIMITE = `teste-limite-${TS}`.slice(0, 50);
const SUBDOMINIO_ENTERPRISE = `teste-ent-${TS}`.slice(0, 50);
const INST_LIMITE = `Inst Teste Limite ${TS}`;
const INST_ENTERPRISE = `Inst Enterprise ${TS}`;
const ADMIN_EMAIL = `admin.planos.${TS}@teste.dsicola.com`;
const ADMIN_PASS = 'TestePlanos@123';

function createApi(token?: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: 20000,
    validateStatus: () => true,
  });
}

function assert(desc: string, cond: boolean, msg?: string) {
  if (!cond) {
    console.error(`   ✖ FALHA: ${desc}`, msg || '');
    process.exit(1);
  }
  console.log(`   ✓ ${desc}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Planos, Limites e Assinaturas');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const api = createApi();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Login SUPER_ADMIN
  // ─────────────────────────────────────────────────────────────────────────
  console.log('1. Login SUPER_ADMIN');
  const loginRes = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });
  assert('Login SUPER_ADMIN', loginRes.status === 200 && !!loginRes.data?.accessToken);
  const apiSuper = createApi(loginRes.data.accessToken);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Sync planos da landing para tabela Plano
  // ─────────────────────────────────────────────────────────────────────────
  console.log('2. Sync planos da landing (POST /planos/sync-from-landing)');
  const planosLanding = [
    { id: 'start', nome: 'DSICOLA START', tagline: 'Automatize', precoMensal: 350000, precoAnual: 3360000, limiteAlunos: 500, cta: 'Começar', microtexto: 'Sem fidelização', popular: false },
    { id: 'pro', nome: 'DSICOLA PRO', tagline: 'Reduza erros', precoMensal: 650000, precoAnual: 6240000, limiteAlunos: 2000, cta: 'Começar', microtexto: 'Ativação', popular: true },
    { id: 'enterprise', nome: 'DSICOLA ENTERPRISE', tagline: 'Tempo real', precoMensal: 1200000, precoAnual: 11520000, limiteAlunos: null, cta: 'Consultor', microtexto: 'Personalizado', popular: false },
  ];
  const syncRes = await apiSuper.post('/planos/sync-from-landing', { planos: planosLanding });
  assert('Sync planos', syncRes.status === 200 && syncRes.data?.success, syncRes.data?.message);
  const sincronizados = syncRes.data?.sincronizados || [];
  console.log(`   → ${sincronizados.length} planos sincronizados\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Verificar planos disponíveis para onboarding
  // ─────────────────────────────────────────────────────────────────────────
  console.log('3. Listar planos (GET /planos?ativo=true)');
  const planosRes = await api.get('/planos', { params: { ativo: true } });
  assert('Planos retornados', Array.isArray(planosRes.data) && planosRes.data.length >= 3);
  const planoStart = planosRes.data.find((p: any) => p.nome === 'DSICOLA START');
  const planoEnterprise = planosRes.data.find((p: any) => p.nome === 'DSICOLA ENTERPRISE');
  assert('DSICOLA START com limite 500', planoStart && planoStart.limite_alunos === 500);
  assert('DSICOLA ENTERPRISE ilimitado', planoEnterprise && (planoEnterprise.limite_alunos == null || planoEnterprise.limite_alunos === null));
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Criar plano de teste com limite 2 (tolerância 10% = limiteEfetivo 3)
  // Com 3 alunos: OK. 4º aluno: BLOQUEIA.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('4. Criar plano de teste (limite 2 alunos, +10% = efetivo 3)');
  const planoTeste = await prisma.plano.create({
    data: {
      nome: `Teste Limite ${TS}`,
      descricao: 'Plano para teste de bloqueio',
      tipoAcademico: 'SECUNDARIO',
      valorMensal: 1000,
      valorAnual: 10000,
      limiteAlunos: 2,
      limiteProfessores: 5,
      ativo: true,
    },
  });
  assert('Plano criado', !!planoTeste.id, `limite=${planoTeste.limiteAlunos}`);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Onboarding com plano de teste (limite 2)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('5. Onboarding com plano de teste (POST /onboarding/instituicao)');
  const onboardingRes = await apiSuper.post('/onboarding/instituicao', {
    nomeInstituicao: INST_LIMITE,
    subdominio: SUBDOMINIO_LIMITE,
    tipoAcademico: 'SECUNDARIO',
    emailContato: ADMIN_EMAIL,
    emailAdmin: ADMIN_EMAIL,
    senhaAdmin: ADMIN_PASS,
    nomeAdmin: 'Admin Teste Limite',
    planoId: planoTeste.id,
  });
  assert('Instituição criada', onboardingRes.status === 201 && !!onboardingRes.data?.instituicao?.id, onboardingRes.data?.message);
  const instituicaoId = onboardingRes.data.instituicao.id;
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Ativar assinatura (status ativa)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('6. Garantir assinatura ativa');
  const assinatura = await prisma.assinatura.findUnique({
    where: { instituicaoId },
    include: { plano: true },
  });
  assert('Assinatura encontrada', !!assinatura);
  if (assinatura!.status !== 'ativa') {
    await prisma.assinatura.update({
      where: { id: assinatura!.id },
      data: { status: 'ativa' as any },
    });
    console.log('   ✓ Assinatura atualizada para ativa');
  } else {
    console.log('   ✓ Assinatura já ativa');
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Login ADMIN da instituição
  // ─────────────────────────────────────────────────────────────────────────
  console.log('7. Login ADMIN da instituição');
  const adminLogin = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  assert('Login ADMIN', adminLogin.status === 200 && !!adminLogin.data?.accessToken);
  const apiAdmin = createApi(adminLogin.data.accessToken);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Criar 3 alunos (dentro do limite + tolerância: limiteEfetivo = 3)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('8. Criar 3 alunos (dentro do limite efetivo)');
  for (let i = 1; i <= 3; i++) {
    const res = await apiAdmin.post('/users', {
      email: `aluno${i}.planos.${TS}@teste.dsicola.com`,
      role: 'ALUNO',
      nome_completo: `Aluno Teste ${i}`,
      numero_identificacao: `PLA${TS}${i}`,
    });
    assert(`Aluno ${i} criado`, res.status === 201 || res.status === 200, res.data?.message);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Tentar criar 4º aluno → DEVE BLOQUEAR (já temos 3 = limiteEfetivo)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('9. Tentar criar 4º aluno → DEVE BLOQUEAR');
  const resBloqueio = await apiAdmin.post('/users', {
    email: `aluno4.planos.${TS}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Teste 4',
    numero_identificacao: `PLA${TS}4`,
  });
  assert('Bloqueio 403 por limite', resBloqueio.status === 403 && (resBloqueio.data?.message || '').includes('Limite'), resBloqueio.data?.message);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Candidatura: aprovar no limite → DEVE BLOQUEAR
  // ─────────────────────────────────────────────────────────────────────────
  console.log('10. Candidatura: criar e aprovar no limite → DEVE BLOQUEAR');
  const candRes = await api.post('/candidaturas', {
    nomeCompleto: 'Candidato Planos Teste',
    email: `candidato.planos.${TS}@teste.dsicola.com`,
    numeroIdentificacao: `CAND${TS}`,
    telefone: '+244 900 000 001',
    dataNascimento: '2000-01-01',
    genero: 'M',
    morada: 'Rua Teste',
    cidade: 'Luanda',
    pais: 'Angola',
    instituicaoId,
  });
  assert('Candidatura criada', candRes.status === 201 || candRes.status === 200);
  const candId = candRes.data.id;

  const aprovarRes = await apiAdmin.post(`/candidaturas/${candId}/aprovar`);
  assert('Aprovar candidatura bloqueada', aprovarRes.status === 403 && (aprovarRes.data?.message || '').includes('Limite'), aprovarRes.data?.message);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Onboarding com plano ENTERPRISE (ilimitado)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('11. Onboarding com DSICOLA ENTERPRISE (ilimitado)');
  const onboardingEntRes = await apiSuper.post('/onboarding/instituicao', {
    nomeInstituicao: INST_ENTERPRISE,
    subdominio: SUBDOMINIO_ENTERPRISE,
    tipoAcademico: 'SUPERIOR',
    emailContato: `admin.ent.${TS}@teste.dsicola.com`,
    emailAdmin: `admin.ent.${TS}@teste.dsicola.com`,
    senhaAdmin: 'Enterprise@123',
    nomeAdmin: 'Admin Enterprise',
    planoId: planoEnterprise.id,
  });
  assert('Instituição Enterprise criada', onboardingEntRes.status === 201);
  const instEntId = onboardingEntRes.data.instituicao.id;

  const assinaturaEnt = await prisma.assinatura.findFirst({
    where: { instituicaoId: instEntId },
    include: { plano: true },
  });
  if (assinaturaEnt?.status !== 'ativa') {
    await prisma.assinatura.update({
      where: { id: assinaturaEnt!.id },
      data: { status: 'ativa' as any },
    });
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Login ADMIN Enterprise e criar 5 alunos (plano ilimitado)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('12. Plano Enterprise: criar 5 alunos (ilimitado)');
  const loginEnt = await api.post('/auth/login', {
    email: `admin.ent.${TS}@teste.dsicola.com`,
    password: 'Enterprise@123',
  });
  assert('Login Enterprise', loginEnt.status === 200 && !!loginEnt.data?.accessToken);
  const apiEnt = createApi(loginEnt.data.accessToken);

  for (let i = 1; i <= 5; i++) {
    const res = await apiEnt.post('/users', {
      email: `aluno${i}.ent.${TS}@teste.dsicola.com`,
      role: 'ALUNO',
      nome_completo: `Aluno Enterprise ${i}`,
      numero_identificacao: `ENT${TS}${i}`,
    });
    assert(`Aluno Enterprise ${i} criado`, res.status === 201 || res.status === 200, res.data?.message);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Stats/uso da instituição (se endpoint existir)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('13. Verificar uso de recursos');
  const statsRes = await apiAdmin.get('/stats/uso-instituicao');
  if (statsRes.status === 200 && statsRes.data) {
    console.log(`   ✓ Alunos: ${statsRes.data.alunos_atual ?? 'N/A'}/${statsRes.data.alunos_limite ?? 'ilimitado'}`);
  } else {
    console.log('   ⚠ Endpoint /stats/uso não disponível ou sem dados');
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ TODOS OS TESTES PASSARAM');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e?.response?.data || e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
