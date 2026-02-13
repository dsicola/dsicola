#!/usr/bin/env npx tsx
/**
 * TESTE E2E: Fluxo completo Ensino Secundário
 * Contexto do Plano de Ensino → Contexto da Distribuição → Contexto do Lançamento → Plano pronto
 *
 * Fluxo:
 * 1. Calendário Acadêmico (evento aprovado)
 * 2. Plano de Ensino (criar, aulas, aprovar)
 * 3. Distribuição de Aulas
 * 4. Lançamento de Aulas
 * 5. Verificação: plano pronto
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-ensino-secundario-fluxo-completo-e2e.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-ensino-secundario-fluxo-completo-e2e.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const INSTITUICAO_ID = process.env.INSTITUICAO_ID;

const TEST_PROF_EMAIL = `prof.e2e.${Date.now()}@teste.dsicola.com`;
const TEST_PROF_PASS = 'Professor@123';

interface Result {
  name: string;
  ok: boolean;
  message?: string;
}

async function run(
  api: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<Result> {
  try {
    const r = await fn();
    const ok = r.status >= 200 && r.status < 300;
    const msg = !ok ? (r.data?.message || JSON.stringify(r.data)?.slice(0, 150)) : undefined;
    return { name, ok, message: msg };
  } catch (e: any) {
    return { name, ok: false, message: e?.response?.data?.message || e.message };
  }
}

function printResults(results: Result[]) {
  console.log('\n--- RESULTADOS ---');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.message ? `: ${r.message}` : ''}`);
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE E2E: Fluxo Completo Ensino Secundário');
  console.log('  Plano de Ensino → Distribuição → Lançamento → Plano pronto');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const results: Result[] = [];

  // ─── 1. Instituição secundária ─────────────────────────────────────────────────────────
  let inst: { id: string; nome: string; tipoAcademico: string | null };
  if (INSTITUICAO_ID) {
    const i = await prisma.instituicao.findUnique({
      where: { id: INSTITUICAO_ID },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!i) {
      console.error('❌ Instituição não encontrada:', INSTITUICAO_ID);
      process.exit(1);
    }
    inst = i;
  } else {
    const i = await prisma.instituicao.findFirst({
      where: {
        OR: [{ tipoAcademico: 'SECUNDARIO' }, { tipoInstituicao: 'ENSINO_MEDIO' }],
      },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!i) {
      console.error('❌ Nenhuma instituição secundária. Crie uma primeiro.');
      process.exit(1);
    }
    inst = i;
  }

  if (inst.tipoAcademico !== 'SECUNDARIO') {
    await prisma.instituicao.update({
      where: { id: inst.id },
      data: { tipoAcademico: 'SECUNDARIO' },
    });
    inst.tipoAcademico = 'SECUNDARIO';
  }

  console.log(`1. Instituição: ${inst.nome} (${inst.id})\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 2. Login SUPER_ADMIN ─────────────────────────────────────────────────────────────
  await prisma.loginAttempt.deleteMany({ where: { email: SUPER_ADMIN_EMAIL.toLowerCase() } });
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  // ─── 3. Admin da instituição secundária ──────────────────────────────────────────────
  let admin = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    const cr = await api.post('/users', {
      email: `admin.e2e.${Date.now()}@teste.dsicola.com`,
      password: SUPER_ADMIN_PASS,
      nomeCompleto: 'Admin E2E Secundário',
      role: 'ADMIN',
      instituicaoId: inst.id,
    });
    if (cr.status >= 400) {
      console.error('❌ Criar ADMIN:', cr.data?.message);
      process.exit(1);
    }
    admin = cr.data;
    await prisma.user.update({ where: { id: admin.id }, data: { mustChangePassword: false } });
  } else {
    const hash = await bcrypt.hash(SUPER_ADMIN_PASS, 10);
    await prisma.user.update({ where: { id: admin.id }, data: { password: hash, mustChangePassword: false } });
  }

  await prisma.loginAttempt.deleteMany({ where: { email: admin.email.toLowerCase() } });
  const loginAdmin = await api.post('/auth/login', { email: admin.email, password: SUPER_ADMIN_PASS });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    console.error('❌ Login ADMIN falhou:', loginAdmin.data?.message);
    process.exit(1);
  }

  const adminApi = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginAdmin.data.accessToken}`,
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 4. Professor ───────────────────────────────────────────────────────────────────
  const createProf = await adminApi.post('/users', {
    email: TEST_PROF_EMAIL,
    password: TEST_PROF_PASS,
    nomeCompleto: 'Professor E2E Secundário',
    role: 'PROFESSOR',
  });
  if (createProf.status >= 400) {
    console.error('❌ Criar professor:', createProf.data?.message);
    process.exit(1);
  }
  const novoUser = createProf.data;
  await prisma.user.update({ where: { id: novoUser.id }, data: { mustChangePassword: false } });
  let professorId: string | null = await prisma.professor
    .findFirst({ where: { userId: novoUser.id, instituicaoId: inst.id }, select: { id: true } })
    .then((p) => p?.id ?? null);
  if (!professorId) {
    const crProf = await adminApi.post(`/users/${novoUser.id}/professor`);
    if (crProf.status >= 400) {
      console.error('❌ Criar entidade professor:', crProf.data?.message);
      process.exit(1);
    }
    professorId = crProf.data?.id;
  }

  // ─── 5. Ano letivo ATIVO ─────────────────────────────────────────────────────────────
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: inst.id, status: 'ATIVO' },
    select: { id: true, ano: true },
  });
  if (!anoLetivo) {
    const al = await prisma.anoLetivo.findFirst({ where: { instituicaoId: inst.id }, select: { id: true, ano: true } });
    if (al) {
      await prisma.anoLetivo.update({
        where: { id: al.id },
        data: { status: 'ATIVO', ativadoEm: new Date(), ativadoPor: admin.id },
      });
      anoLetivo = al;
    } else {
      const ano = new Date().getFullYear();
      const novo = await prisma.anoLetivo.create({
        data: {
          instituicaoId: inst.id,
          ano,
          dataInicio: new Date(ano, 0, 1),
          dataFim: new Date(ano, 11, 31),
          status: 'ATIVO',
          ativadoEm: new Date(),
          ativadoPor: admin.id,
        },
      });
      anoLetivo = { id: novo.id, ano: novo.ano };
    }
  }

  // ─── 6. Trimestre ATIVO ─────────────────────────────────────────────────────────────
  let trimestre = await prisma.trimestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, instituicaoId: inst.id },
    select: { id: true, numero: true, dataInicio: true, dataFim: true },
  });
  if (!trimestre) {
    trimestre = await prisma.trimestre.create({
      data: {
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        numero: 1,
        dataInicio: new Date(anoLetivo.ano, 0, 1),
        dataFim: new Date(anoLetivo.ano, 2, 31),
        instituicaoId: inst.id,
        status: 'ATIVO',
        estado: 'RASCUNHO',
        ativadoEm: new Date(),
        ativadoPor: admin.id,
      },
      select: { id: true, numero: true, dataInicio: true, dataFim: true },
    }) as any;
  } else {
    await prisma.trimestre.update({
      where: { id: trimestre.id },
      data: { status: 'ATIVO', ativadoEm: new Date(), ativadoPor: admin.id },
    });
  }

  // ─── 7. Classe, Disciplina, Turma ────────────────────────────────────────────────────
  let classe = await prisma.classe.findFirst({
    where: { instituicaoId: inst.id },
    select: { id: true, nome: true },
  });
  if (!classe) {
    classe = await prisma.classe.create({
      data: { instituicaoId: inst.id, nome: '10ª Classe', codigo: '10C' },
      select: { id: true, nome: true },
    });
  }

  const codigoDisc = `MAT-E2E-${Date.now()}`;
  const cargaHoraria = 12; // 3 aulas x 4 = 12
  let disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId: inst.id, codigo: codigoDisc },
    select: { id: true, nome: true, cargaHoraria: true },
  });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: {
        instituicaoId: inst.id,
        nome: `Matemática E2E ${Date.now()}`,
        codigo: codigoDisc,
        cargaHoraria,
      },
      select: { id: true, nome: true, cargaHoraria: true },
    });
  }

  let turma = await prisma.turma.findFirst({
    where: {
      instituicaoId: inst.id,
      anoLetivoId: anoLetivo.id,
      classeId: classe.id,
    },
    select: { id: true, nome: true },
  });
  if (!turma) {
    const createTurma = await adminApi.post('/turmas', {
      nome: `Turma 10A E2E ${Date.now()}`,
      classeId: classe.id,
      anoLetivoId: anoLetivo.id,
      capacidade: 30,
    });
    if (createTurma.status >= 400) {
      console.error('❌ Criar turma:', createTurma.data?.message);
      process.exit(1);
    }
    turma = createTurma.data;
  }

  // Vincular professor à disciplina (ProfessorDisciplina)
  const vinculo = await prisma.professorDisciplina.findFirst({
    where: { professorId: professorId!, disciplinaId: disciplina.id, cursoId: null },
  });
  if (!vinculo) {
    await prisma.professorDisciplina.create({
      data: {
        professorId: professorId!,
        disciplinaId: disciplina.id,
        cursoId: null, // Secundário: sem curso
      },
    });
  }

  // ─── 8. CONTEXTO PLANO: Calendário Acadêmico APROVADO ─────────────────────────────────
  console.log('8. Calendário Acadêmico (evento + workflow)...');
  let evento = await prisma.eventoCalendario.findFirst({
    where: { instituicaoId: inst.id, status: 'APROVADO' },
    select: { id: true },
  });
  if (!evento) {
    const createEv = await adminApi.post('/eventos', {
      titulo: 'Ano Letivo E2E',
      dataInicio: new Date(anoLetivo.ano, 0, 1).toISOString().split('T')[0],
      dataFim: new Date(anoLetivo.ano, 11, 31).toISOString().split('T')[0],
      tipo: 'evento',
    });
    if (createEv.status >= 400) {
      results.push({ name: 'Criar evento calendário', ok: false, message: createEv.data?.message });
    } else {
      const eventoId = createEv.data.id;
      const sub = await adminApi.post('/workflow/submeter', { entidade: 'EventoCalendario', entidadeId: eventoId });
      const apr = await adminApi.post('/workflow/aprovar', { entidade: 'EventoCalendario', entidadeId: eventoId });
      results.push({ name: 'Evento submetido', ok: sub.status === 200 });
      results.push({ name: 'Evento aprovado', ok: apr.status === 200 });
      evento = { id: eventoId };
    }
  } else {
    results.push({ name: 'Calendário já aprovado', ok: true });
  }

  // ─── 9. CONTEXTO PLANO: GET contexto ──────────────────────────────────────────────────
  console.log('9. GET /plano-ensino/contexto...');
  const ctx = await adminApi.get('/plano-ensino/contexto');
  results.push({
    name: 'GET contexto plano',
    ok: ctx.status === 200 && Array.isArray(ctx.data?.classes),
    message: ctx.status !== 200 ? ctx.data?.message : undefined,
  });

  // ─── 10. CONTEXTO PLANO: Criar plano de ensino ────────────────────────────────────────
  console.log('10. POST /plano-ensino (com turmaId)...');
  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    classeId: classe.id,
    classeOuAno: classe.nome,
    turmaId: turma.id,
    metodologia: 'Aulas expositivas e exercícios',
    objetivos: 'Objetivos de aprendizagem da disciplina',
    conteudoProgramatico: 'Conteúdo programático completo',
    criteriosAvaliacao: 'Provas e trabalhos práticos',
  });
  results.push({
    name: 'Criar plano de ensino',
    ok: createPlano.status >= 200 && createPlano.status < 300,
    message: createPlano.status >= 400 ? createPlano.data?.message : undefined,
  });

  if (createPlano.status >= 400) {
    console.error('   Payload:', JSON.stringify(createPlano.data, null, 2));
    printResults(results);
    process.exit(1);
  }

  const plano = createPlano.data;
  const planoId = plano.id;

  // Atualizar ementa (obrigatória para aprovação)
  await adminApi.put(`/plano-ensino/${planoId}`, {
    ementa: 'Ementa da disciplina de Matemática para ensino secundário',
  });

  // ─── 11. Adicionar aulas planejadas (soma = cargaHoraria) ──────────────────────────────
  console.log('11. Adicionar aulas planejadas...');
  const aulasPorAdicionar = cargaHoraria === 12 ? 3 : Math.ceil(cargaHoraria / 4);
  const horasPorAula = Math.floor(cargaHoraria / aulasPorAdicionar);
  const aulasIds: string[] = [];
  for (let i = 0; i < aulasPorAdicionar; i++) {
    const qtd = i === aulasPorAdicionar - 1 ? cargaHoraria - (aulasPorAdicionar - 1) * horasPorAula : horasPorAula;
    const createAula = await adminApi.post(`/plano-ensino/${planoId}/aulas`, {
      titulo: `Aula ${i + 1}`,
      descricao: `Conteúdo aula ${i + 1}`,
      tipo: 'TEORICA',
      quantidadeAulas: qtd,
    });
    if (createAula.status >= 200 && createAula.status < 300) {
      aulasIds.push(createAula.data.id);
    }
  }
  results.push({
    name: `Criar ${aulasPorAdicionar} aulas planejadas`,
    ok: aulasIds.length === aulasPorAdicionar,
    message: aulasIds.length < aulasPorAdicionar ? `Criadas ${aulasIds.length}/${aulasPorAdicionar}` : undefined,
  });

  // ─── 12. Workflow: submeter e aprovar plano ──────────────────────────────────────────
  console.log('12. Workflow submeter + aprovar plano...');
  const subPlano = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoId });
  results.push({
    name: 'Submeter plano',
    ok: subPlano.status === 200,
    message: subPlano.status !== 200 ? subPlano.data?.message : undefined,
  });
  if (subPlano.status >= 400) {
    console.error('   Submeter erro:', subPlano.data);
  }

  const aprPlano = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoId });
  results.push({
    name: 'Aprovar plano',
    ok: aprPlano.status === 200,
    message: aprPlano.status !== 200 ? aprPlano.data?.message : undefined,
  });
  if (aprPlano.status >= 400) {
    console.error('   Aprovar erro:', aprPlano.data);
    printResults(results);
    process.exit(1);
  }

  // ─── 13. CONTEXTO DISTRIBUIÇÃO: Gerar distribuição ───────────────────────────────────
  console.log('13. POST /distribuicao-aulas/gerar...');
  const dataInicio = (trimestre.dataInicio as Date) || new Date(anoLetivo.ano, 0, 15);
  const dataInicioStr = typeof dataInicio === 'string' ? dataInicio : new Date(dataInicio).toISOString().split('T')[0];
  const gerarDist = await adminApi.post('/distribuicao-aulas/gerar', {
    planoEnsinoId: planoId,
    dataInicio: dataInicioStr,
    diasSemana: [1, 3, 5], // Seg, Qua, Sex
  });
  results.push({
    name: 'Gerar distribuição de aulas',
    ok: gerarDist.status >= 200 && gerarDist.status < 300,
    message: gerarDist.status >= 400 ? gerarDist.data?.message : undefined,
  });

  // ─── 14. Login como PROFESSOR para lançamento ──────────────────────────────────────────
  await prisma.loginAttempt.deleteMany({ where: { email: TEST_PROF_EMAIL.toLowerCase() } });
  const loginProf = await api.post('/auth/login', { email: TEST_PROF_EMAIL, password: TEST_PROF_PASS });
  if (loginProf.status !== 200 || !loginProf.data?.accessToken) {
    results.push({ name: 'Login professor para lançamento', ok: false, message: loginProf.data?.message });
  } else {
    const profApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginProf.data.accessToken}`,
      },
      timeout: 20000,
      validateStatus: () => true,
    });

    // ─── 15. CONTEXTO LANÇAMENTO: Lançar aula ───────────────────────────────────────────
    console.log('15. POST /aulas-lancadas (como professor)...');
    const dataLancamento = typeof dataInicio === 'string' ? dataInicio : (dataInicio as Date).toISOString().split('T')[0];
    const lancar = await profApi.post('/aulas-lancadas', {
      planoAulaId: aulasIds[0],
      data: dataLancamento,
      observacoes: 'Aula ministrada conforme planejado',
    });
    results.push({
      name: 'Lançar aula (professor)',
      ok: lancar.status >= 200 && lancar.status < 300,
      message: lancar.status >= 400 ? lancar.data?.message : undefined,
    });
  }

  // ─── 16. Verificação: plano pronto ───────────────────────────────────────────────────
  const planoFinal = await prisma.planoEnsino.findUnique({
    where: { id: planoId },
    include: {
      aulas: {
        include: {
          aulasLancadas: true,
          distribuicoes: true,
        },
      },
    },
  });

  const estadoAprovado = planoFinal?.estado === 'APROVADO' || planoFinal?.status === 'APROVADO';
  const temDistribuicao = (planoFinal?.aulas?.reduce((s, a) => s + (a.distribuicoes?.length ?? 0), 0) ?? 0) > 0;
  const temLancamento = (planoFinal?.aulas?.reduce((s, a) => s + (a.aulasLancadas?.length ?? 0), 0) ?? 0) > 0;

  results.push({ name: 'Plano estado APROVADO', ok: estadoAprovado });
  results.push({ name: 'Plano tem distribuição', ok: temDistribuicao });
  results.push({ name: 'Plano tem lançamento', ok: temLancamento });
  results.push({
    name: 'Plano pronto (contexto completo)',
    ok: estadoAprovado && temDistribuicao && temLancamento,
  });

  await prisma.$disconnect();

  printResults(results);
  const falhas = results.filter((r) => !r.ok);
  if (falhas.length > 0) {
    console.log(`\n❌ ${falhas.length} falha(s).\n`);
    process.exit(1);
  }
  console.log('\n✅ TESTE PASSOU: Fluxo completo Ensino Secundário (Plano → Distribuição → Lançamento) até plano pronto.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
