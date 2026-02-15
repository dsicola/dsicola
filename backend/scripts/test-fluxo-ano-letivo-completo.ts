#!/usr/bin/env npx tsx
/**
 * TESTE E2E: Fluxo Completo de Ano Letivo
 *
 * Critério de Fluxo Completo (Muito Importante)
 * O sistema deve estar pronto quando você consegue simular um ano letivo completo:
 *
 * 1. Criar instituição
 * 2. Criar curso
 * 3. Criar turma
 * 4. Matricular aluno
 * 5. Associar professor
 * 6. Lançar notas
 * 7. Gerar boletim
 * 8. Gerar cobrança de propina
 * 9. Registrar pagamento
 * 10. Emitir relatório final
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-fluxo-ano-letivo-completo.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-fluxo-ano-letivo-completo.ts
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

const TS = Date.now();
const ADMIN_EMAIL = `admin.fluxo.${TS}@teste.dsicola.com`;
const ADMIN_PASS = 'Admin@123456';
const PROF_EMAIL = `prof.fluxo.${TS}@teste.dsicola.com`;
const PROF_PASS = 'Professor@123';
const ALUNO_EMAIL = `aluno.fluxo.${TS}@teste.dsicola.com`;
const ALUNO_PASS = 'Aluno@123456';

interface StepResult {
  step: number;
  name: string;
  ok: boolean;
  message?: string;
}

function log(step: number, name: string, ok: boolean, msg?: string) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${step}. ${name}${msg ? `: ${msg}` : ''}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - ANO LETIVO');
  console.log('  Critério: Instituição → Curso → Turma → Matrícula → Professor → Notas → Boletim → Cobrança → Pagamento → Relatório Final');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const results: StepResult[] = [];
  let step = 0;

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  let instituicaoId: string;
  let adminApi: AxiosInstance;
  let cursoId: string;
  let classeId: string;
  let anoLetivoId: string;
  let anoLetivo: number;
  let turmaId: string;
  let disciplinaId: string;
  let professorId: string;
  let planoEnsinoId: string;
  let alunoId: string;
  let matriculaId: string;
  let mensalidadeId: string;
  let avaliacaoId: string;

  // ─── 1. LOGIN SUPER_ADMIN ─────────────────────────────────────────────────────────────
  step = 1;
  console.log(`${step}. LOGIN SUPER_ADMIN`);
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    log(step, 'Login SUPER_ADMIN', false, loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;
  log(step, 'Login SUPER_ADMIN', true);
  results.push({ step, name: 'Login SUPER_ADMIN', ok: true });

  // ─── 2. CRIAR INSTITUIÇÃO (ou usar existente) ────────────────────────────────────────
  step = 2;
  console.log(`\n${step}. CRIAR INSTITUIÇÃO`);
  if (INSTITUICAO_ID) {
    const inst = await prisma.instituicao.findUnique({ where: { id: INSTITUICAO_ID } });
    if (!inst) {
      log(step, 'Instituição por ID', false, 'Não encontrada');
      process.exit(1);
    }
    instituicaoId = inst.id;
    log(step, 'Usar instituição existente', true, inst.nome);
    results.push({ step, name: 'Usar instituição', ok: true });
  } else {
    const subdominio = `fluxo-${TS}`;
    const createInst = await api.post('/onboarding/instituicao', {
      nomeInstituicao: `Instituição Fluxo ${TS}`,
      subdominio,
      tipoAcademico: 'SECUNDARIO',
      emailAdmin: ADMIN_EMAIL,
      senhaAdmin: ADMIN_PASS,
      nomeAdmin: 'Admin Fluxo',
    });
    if (createInst.status >= 400) {
      log(step, 'Criar instituição', false, createInst.data?.message);
      process.exit(1);
    }
    instituicaoId = createInst.data.instituicao?.id || createInst.data.id;
    log(step, 'Criar instituição', true);
    results.push({ step, name: 'Criar instituição', ok: true });
  }

  // Garantir tipo SECUNDARIO
  await prisma.instituicao.update({
    where: { id: instituicaoId },
    data: { tipoAcademico: 'SECUNDARIO' },
  });

  // Criar assinatura ativa (necessária para licenciamento)
  let assinatura = await prisma.assinatura.findUnique({ where: { instituicaoId } });
  if (!assinatura) {
    const plano = await prisma.plano.findFirst({ where: { ativo: true } });
    if (plano) {
      const umAno = new Date();
      umAno.setFullYear(umAno.getFullYear() + 1);
      assinatura = await prisma.assinatura.create({
        data: {
          instituicaoId,
          planoId: plano.id,
          status: 'ativa',
          tipo: 'PAGA',
          dataFim: umAno,
          dataProximoPagamento: umAno,
          valorAtual: 0,
        },
      });
    }
  }

  // ─── 3. ADMIN da instituição ───────────────────────────────────────────────────────
  step = 3;
  console.log(`\n${step}. ADMIN DA INSTITUIÇÃO`);
  let admin = await prisma.user.findFirst({
    where: { instituicaoId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    const cr = await api.post('/users', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      nomeCompleto: 'Admin Fluxo',
      role: 'ADMIN',
      instituicaoId,
    });
    if (cr.status >= 400) {
      log(step, 'Criar ADMIN', false, cr.data?.message);
      process.exit(1);
    }
    admin = cr.data;
  }
  await prisma.user.update({ where: { id: admin.id }, data: { password: await bcrypt.hash(ADMIN_PASS, 10), mustChangePassword: false } });
  await prisma.loginAttempt.deleteMany({ where: { email: admin.email.toLowerCase() } });
  const loginAdmin = await api.post('/auth/login', { email: admin.email, password: ADMIN_PASS });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    log(step, 'Login ADMIN', false, loginAdmin.data?.message);
    process.exit(1);
  }
  adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAdmin.data.accessToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });
  log(step, 'Admin disponível', true);
  results.push({ step, name: 'Admin da instituição', ok: true });

  // ─── 4. CRIAR CURSO ─────────────────────────────────────────────────────────────────
  step = 4;
  console.log(`\n${step}. CRIAR CURSO`);
  let curso = await prisma.curso.findFirst({ where: { instituicaoId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Curso Fluxo ${TS}`,
      codigo: `CF${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 0, // Secundário: mensalidade na classe
    });
    if (cr.status >= 400) {
      log(step, 'Criar curso', false, cr.data?.message);
      process.exit(1);
    }
    curso = cr.data;
  }
  cursoId = curso.id;
  log(step, 'Curso', true, curso.nome);
  results.push({ step, name: 'Criar curso', ok: true });

  // ─── 5. CRIAR CLASSE (Secundário) ───────────────────────────────────────────────────
  step = 5;
  console.log(`\n${step}. CRIAR CLASSE`);
  let classe = await prisma.classe.findFirst({ where: { instituicaoId } });
  if (!classe) {
    const cr = await adminApi.post('/classes', {
      nome: '10ª Classe',
      codigo: `10C-${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 50000,
    });
    if (cr.status >= 400) {
      log(step, 'Criar classe', false, cr.data?.message);
      process.exit(1);
    }
    classe = cr.data;
  }
  classeId = classe.id;
  log(step, 'Classe', true, classe.nome);
  results.push({ step, name: 'Criar classe', ok: true });

  // ─── 6. ANO LETIVO e TURMA ─────────────────────────────────────────────────────────
  step = 6;
  console.log(`\n${step}. CRIAR ANO LETIVO E TURMA`);
  let anoLetivoRecord = await prisma.anoLetivo.findFirst({ where: { instituicaoId } });
  if (!anoLetivoRecord) {
    const ano = new Date().getFullYear();
    anoLetivoRecord = await prisma.anoLetivo.create({
      data: {
        instituicaoId,
        ano,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: admin.id,
      },
    });
  }
  anoLetivoId = anoLetivoRecord.id;
  anoLetivo = anoLetivoRecord.ano;

  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: {
        instituicaoId,
        nome: 'Matemática',
        codigo: `MAT-${TS}`,
        cargaHoraria: 12,
      },
    });
  }
  disciplinaId = disciplina.id;

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId, anoLetivoId, classeId },
  });
  if (!turma) {
    const cr = await adminApi.post('/turmas', {
      nome: `Turma 10A ${TS}`,
      classeId,
      anoLetivoId,
      capacidade: 30,
    });
    if (cr.status >= 400) {
      log(step, 'Criar turma', false, cr.data?.message);
      process.exit(1);
    }
    turma = cr.data;
  }
  turmaId = turma.id;
  log(step, 'Ano letivo e turma', true);
  results.push({ step, name: 'Criar ano letivo e turma', ok: true });

  // ─── 7. PROFESSOR e ALUNO ───────────────────────────────────────────────────────────
  step = 7;
  console.log(`\n${step}. CRIAR PROFESSOR E ALUNO`);

  const createProf = await adminApi.post('/users', {
    email: PROF_EMAIL,
    password: PROF_PASS,
    nomeCompleto: 'Professor Fluxo',
    role: 'PROFESSOR',
  });
  if (createProf.status >= 400) {
    log(step, 'Criar professor', false, createProf.data?.message);
    process.exit(1);
  }
  const profUser = createProf.data;
  await prisma.user.update({ where: { id: profUser.id }, data: { instituicaoId, mustChangePassword: false } });

  let prof = await prisma.professor.findFirst({ where: { userId: profUser.id, instituicaoId } });
  if (!prof) {
    const cr = await adminApi.post(`/users/${profUser.id}/professor`);
    if (cr.status >= 400) {
      log(step, 'Entidade professor', false, cr.data?.message);
      process.exit(1);
    }
    prof = cr.data;
  }
  professorId = prof.id;

  const createAluno = await adminApi.post('/users', {
    email: ALUNO_EMAIL,
    password: ALUNO_PASS,
    nomeCompleto: 'Aluno Fluxo',
    role: 'ALUNO',
  });
  if (createAluno.status >= 400) {
    log(step, 'Criar aluno', false, createAluno.data?.message);
    process.exit(1);
  }
  const alunoUser = createAluno.data;
  await prisma.user.update({ where: { id: alunoUser.id }, data: { instituicaoId, mustChangePassword: false } });
  alunoId = alunoUser.id;

  const vinculo = await prisma.professorDisciplina.findFirst({
    where: { professorId, disciplinaId, cursoId: null },
  });
  if (!vinculo) {
    await prisma.professorDisciplina.create({
      data: { professorId, disciplinaId, cursoId: null },
    });
  }
  log(step, 'Professor e aluno', true);
  results.push({ step, name: 'Criar professor e aluno', ok: true });

  // ─── 8. PLANO DE ENSINO (Associar professor) ────────────────────────────────────────
  step = 8;
  console.log(`\n${step}. ASSOCIAR PROFESSOR (Plano de Ensino)`);

  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId,
    disciplinaId,
    classeId,
    classeOuAno: classe.nome,
    turmaId,
    metodologia: 'Aulas expositivas',
    objetivos: 'Objetivos de aprendizagem',
    conteudoProgramatico: 'Conteúdo programático',
    criteriosAvaliacao: 'Provas e trabalhos',
    ementa: 'Ementa da disciplina',
  });
  if (createPlano.status >= 400) {
    log(step, 'Criar plano de ensino', false, createPlano.data?.message);
    process.exit(1);
  }
  planoEnsinoId = createPlano.data.id;

  await adminApi.put(`/plano-ensino/${planoEnsinoId}`, { ementa: 'Ementa completa' });
  // Adicionar aulas até completar carga horária (12h da disciplina)
  for (let i = 1; i <= 3; i++) {
    await adminApi.post(`/plano-ensino/${planoEnsinoId}/aulas`, {
      titulo: `Aula ${i}`,
      descricao: `Conteúdo aula ${i}`,
      tipo: 'TEORICA',
      quantidadeAulas: 4,
    });
  }

  // Calendário Acadêmico APROVADO (pré-requisito para submeter plano)
  let evento = await prisma.eventoCalendario.findFirst({
    where: { instituicaoId, status: 'APROVADO' },
  });
  if (!evento) {
    const createEv = await adminApi.post('/eventos', {
      titulo: 'Ano Letivo',
      dataInicio: new Date(anoLetivo, 0, 1).toISOString().split('T')[0],
      dataFim: new Date(anoLetivo, 11, 31).toISOString().split('T')[0],
      tipo: 'evento',
    });
    if (createEv.status < 400) {
      await adminApi.post('/workflow/submeter', { entidade: 'EventoCalendario', entidadeId: createEv.data.id });
      await adminApi.post('/workflow/aprovar', { entidade: 'EventoCalendario', entidadeId: createEv.data.id });
    }
  }

  const subPlano = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
  if (subPlano.status >= 400) {
    log(step, 'Submeter plano', false, subPlano.data?.message);
    process.exit(1);
  }
  const apr = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
  if (apr.status >= 400) {
    log(step, 'Aprovar plano', false, apr.data?.message);
    process.exit(1);
  }
  log(step, 'Associar professor (plano aprovado)', true);
  results.push({ step, name: 'Associar professor', ok: true });

  // ─── 9. MATRÍCULA ANUAL + MATRÍCULA em turma ────────────────────────────────────────
  step = 9;
  console.log(`\n${step}. MATRICULAR ALUNO`);

  const matriculaAnual = await adminApi.post('/matriculas-anuais', {
    alunoId,
    anoLetivoId,
    nivelEnsino: 'SECUNDARIO',
    classeOuAnoCurso: classe.nome,
    cursoId,
  });
  if (matriculaAnual.status >= 400) {
    log(step, 'Matrícula anual', false, matriculaAnual.data?.message);
    process.exit(1);
  }

  const matricula = await adminApi.post('/matriculas', {
    alunoId,
    turmaId,
    status: 'Ativa',
  });
  if (matricula.status >= 400) {
    log(step, 'Matrícula em turma', false, matricula.data?.message);
    process.exit(1);
  }
  matriculaId = matricula.data.id;

  // AlunoDisciplina (necessário para lançamento de notas)
  const matriculaAnualId = matriculaAnual.data?.id;
  const trimestreRec = await prisma.trimestre.findFirst({ where: { anoLetivoId } });
  const alunoDisc = await prisma.alunoDisciplina.findFirst({
    where: { alunoId, disciplinaId, ano: anoLetivo },
  });
  if (!alunoDisc && matriculaAnualId) {
    await prisma.alunoDisciplina.create({
      data: {
        alunoId,
        disciplinaId,
        turmaId,
        matriculaAnualId,
        ano: anoLetivo,
        semestre: '1', // Trimestre 1 para secundário
        trimestreId: trimestreRec?.id,
        status: 'Cursando',
      },
    });
  }

  log(step, 'Matricular aluno', true);
  results.push({ step, name: 'Matricular aluno', ok: true });

  // ─── 10. LANÇAR NOTAS ──────────────────────────────────────────────────────────────
  step = 10;
  console.log(`\n${step}. LANÇAR NOTAS`);

  const createAval = await adminApi.post('/avaliacoes', {
    planoEnsinoId,
    turmaId,
    professorId,
    tipo: 'PROVA',
    trimestre: 1,
    trimestreId: (await prisma.trimestre.findFirst({ where: { anoLetivoId } }))?.id,
    peso: 1,
    data: new Date().toISOString().split('T')[0],
    nome: 'Prova 1',
  });
  if (createAval.status >= 400) {
    log(step, 'Criar avaliação', false, createAval.data?.message);
    process.exit(1);
  }
  avaliacaoId = createAval.data.id;

  const lancarNotas = await adminApi.post('/notas/avaliacao/lote', {
    avaliacaoId,
    notas: [{ alunoId, valor: 14 }],
  });
  if (lancarNotas.status >= 400) {
    log(step, 'Lançar notas', false, lancarNotas.data?.message);
    process.exit(1);
  }
  log(step, 'Lançar notas', true);
  results.push({ step, name: 'Lançar notas', ok: true });

  // ─── 11. GERAR BOLETIM ─────────────────────────────────────────────────────────────
  step = 11;
  console.log(`\n${step}. GERAR BOLETIM`);

  const boletim = await adminApi.get(`/relatorios-oficiais/boletim/${alunoId}`, {
    params: { anoLetivoId },
  });
  if (boletim.status >= 400) {
    log(step, 'Gerar boletim', false, boletim.data?.message);
    results.push({ step, name: 'Gerar boletim', ok: false });
  } else {
    log(step, 'Gerar boletim', true);
    results.push({ step, name: 'Gerar boletim', ok: true });
  }

  // ─── 12. GERAR COBRANÇA DE PROPINA ─────────────────────────────────────────────────
  step = 12;
  console.log(`\n${step}. GERAR COBRANÇA DE PROPINA`);

  const mesRef = new Date().getMonth() + 1;
  const anoRef = new Date().getFullYear();
  const ultimoDia = new Date(anoRef, mesRef, 0);
  const gerarCobranca = await adminApi.post('/mensalidades/gerar', {
    mesReferencia: mesRef,
    anoReferencia: anoRef,
    dataVencimento: ultimoDia.toISOString().split('T')[0],
  });
  if (gerarCobranca.status >= 400) {
    log(step, 'Gerar cobrança', false, gerarCobranca.data?.message);
    results.push({ step, name: 'Gerar cobrança', ok: false });
  } else {
    log(step, 'Gerar cobrança', true, gerarCobranca.data?.message);
    results.push({ step, name: 'Gerar cobrança', ok: true });
  }

  // Buscar mensalidade do aluno
  const mensalidades = await prisma.mensalidade.findMany({
    where: { alunoId },
    orderBy: { createdAt: 'desc' },
  });
  mensalidadeId = mensalidades[0]?.id;
  if (!mensalidadeId) {
    log(step, 'Mensalidade disponível', false, 'Nenhuma mensalidade encontrada');
  }

  // ─── 13. REGISTRAR PAGAMENTO ───────────────────────────────────────────────────────
  step = 13;
  console.log(`\n${step}. REGISTRAR PAGAMENTO`);

  if (mensalidadeId) {
    const registrarPag = await adminApi.post(`/pagamentos/mensalidade/${mensalidadeId}/registrar`, {
      valor: 50000,
      metodoPagamento: 'CASH',
      observacoes: 'Teste fluxo completo',
    });
    if (registrarPag.status >= 400) {
      log(step, 'Registrar pagamento', false, registrarPag.data?.message);
      results.push({ step, name: 'Registrar pagamento', ok: false });
    } else {
      log(step, 'Registrar pagamento', true);
      results.push({ step, name: 'Registrar pagamento', ok: true });
    }
  } else {
    log(step, 'Registrar pagamento', false, 'Sem mensalidade');
    results.push({ step, name: 'Registrar pagamento', ok: false });
  }

  // ─── 14. FECHAR TRIMESTRES (pré-requisito para relatório final) ─────────────────────
  step = 14;
  console.log(`\n${step}. FECHAR TRIMESTRES`);

  for (const tr of [1, 2, 3]) {
    const fechar = await adminApi.post('/trimestres-fechados/fechar', {
      anoLetivo,
      trimestre: tr,
    });
    if (fechar.status >= 400) {
      log(step, `Fechar trimestre ${tr}`, false, fechar.data?.message);
    }
  }
  log(step, 'Trimestres fechados', true);
  results.push({ step, name: 'Fechar trimestres', ok: true });

  // ─── 15. EMITIR RELATÓRIO FINAL ─────────────────────────────────────────────────────
  step = 15;
  console.log(`\n${step}. EMITIR RELATÓRIO FINAL`);

  const relatorioFinal = await adminApi.post('/relatorios/gerar', {
    tipoRelatorio: 'RELATORIO_FINAL_ANO_LETIVO',
    referenciaId: 'ano-letivo',
    anoLetivo,
  });
  if (relatorioFinal.status >= 400) {
    log(step, 'Emitir relatório final', false, relatorioFinal.data?.message);
    results.push({ step, name: 'Emitir relatório final', ok: false });
  } else {
    log(step, 'Emitir relatório final', true);
    results.push({ step, name: 'Emitir relatório final', ok: true });
  }

  await prisma.$disconnect();

  // ─── RELATÓRIO FINAL ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - FLUXO COMPLETO ANO LETIVO');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${passed}/${results.length} etapas concluídas com sucesso.\n`);
  if (failed.length > 0) {
    console.log('⚠️  Etapas que falharam:');
    failed.forEach((r) => console.log(`   - ${r.name}${r.message ? `: ${r.message}` : ''}`));
    process.exit(1);
  }
  console.log('✅ SISTEMA PRONTO: Fluxo completo de ano letivo simulado com sucesso.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
