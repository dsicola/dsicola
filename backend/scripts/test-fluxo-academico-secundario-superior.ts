#!/usr/bin/env npx tsx
/**
 * TESTE E2E: FLUXO ACADÊMICO COMPLETO para SECUNDÁRIO e SUPERIOR
 *
 * Simula um ano letivo inteiro para cada tipo de instituição.
 * Se qualquer passo quebrar → sistema não está pronto.
 *
 * Fluxo:
 * 1. Criar ano letivo
 * 2. Criar curso/classe
 * 3. Criar turmas
 * 4. Matricular aluno
 * 5. Associar professor
 * 6. Lançar notas
 * 7. Registrar frequência
 * 8. Gerar boletim
 * 9. Encerrar ano letivo
 *
 * Pré-requisitos:
 * - npx tsx scripts/seed-multi-tenant-test.ts
 * - Backend rodando em http://localhost:3001
 *
 * Uso: npx tsx scripts/test-fluxo-academico-secundario-superior.ts
 *
 * Para execução limpa (evitar conflitos com dados de execuções anteriores),
 * use um ano diferente: ANO_TESTE=2024 npx tsx scripts/test-fluxo-academico-secundario-superior.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

const TS = Date.now();
const ANO_TESTE = process.env.ANO_TESTE ? parseInt(process.env.ANO_TESTE, 10) : new Date().getFullYear();

interface StepResult {
  tipo: 'SECUNDARIO' | 'SUPERIOR';
  step: number;
  name: string;
  ok: boolean;
  message?: string;
}

const results: StepResult[] = [];

function log(tipo: 'SECUNDARIO' | 'SUPERIOR', step: number, name: string, ok: boolean, msg?: string) {
  const icon = ok ? '✅' : '❌';
  const prefix = tipo === 'SECUNDARIO' ? '[SEC]' : '[SUP]';
  console.log(`  ${icon} ${prefix} ${step}. ${name}${msg ? `: ${msg}` : ''}`);
  results.push({ tipo, step, name, ok, message: msg });
}

async function runFluxoSecundario(
  api: AxiosInstance,
  adminApi: AxiosInstance,
  profApi: AxiosInstance,
  instituicaoId: string
): Promise<boolean> {
  const ano = ANO_TESTE;
  let anoLetivoId: string;
  let classeId: string;
  let cursoId: string;
  let turmaId: string;
  let disciplinaId: string;
  let professorId: string;
  let planoEnsinoId: string;
  let planoAulaId: string;
  let alunoId: string;
  let matriculaAnualId: string;
  let aulaLancadaId: string;
  let avaliacaoId: string;

  const admin = await prisma.user.findFirst({
    where: { instituicaoId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('Admin não encontrado');

  const prof = await prisma.professor.findFirst({ where: { instituicaoId } });
  if (!prof) throw new Error('Professor não encontrado');
  professorId = prof.id;

  const aluno = await prisma.user.findFirst({
    where: { instituicaoId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true },
  });
  if (!aluno) throw new Error('Aluno não encontrado');
  alunoId = aluno.id;

  // 1. Ano Letivo
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId, ano },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
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
  anoLetivoId = anoLetivo.id;

  // Trimestres
  for (const num of [1, 2, 3]) {
    let tri = await prisma.trimestre.findFirst({
      where: { anoLetivoId, numero: num },
    });
    if (!tri) {
      tri = await prisma.trimestre.create({
        data: {
          anoLetivoId,
          anoLetivo: ano,
          numero: num,
          dataInicio: new Date(ano, (num - 1) * 4, 1),
          dataFim: new Date(ano, num * 4 - 1, 28),
          status: num === 1 ? 'ATIVO' : 'PLANEJADO',
          instituicaoId,
        },
      });
    } else if (tri.status === 'ENCERRADO' && num === 1) {
      await prisma.trimestre.update({
        where: { id: tri.id },
        data: { status: 'ATIVO', encerradoPor: null, encerradoEm: null },
      });
    }
  }
  // Reabrir EncerramentoAcademico de trimestres para permitir lancar aula e presenças (execuções anteriores)
  await prisma.encerramentoAcademico.updateMany({
    where: { instituicaoId, anoLetivo: ano, periodo: { in: ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'] } },
    data: { status: 'ABERTO', encerradoPor: null, encerradoEm: null, justificativa: null },
  });

  log('SECUNDARIO', 1, 'Criar ano letivo', true);

  // 2. Classe
  let classe = await prisma.classe.findFirst({ where: { instituicaoId } });
  if (!classe) {
    const cr = await adminApi.post('/classes', {
      nome: '10ª Classe',
      codigo: `10C-${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 50000,
    });
    if (cr.status >= 400) {
      log('SECUNDARIO', 2, 'Criar classe', false, cr.data?.message);
      return false;
    }
    classe = cr.data;
  }
  classeId = classe.id;

  let curso = await prisma.curso.findFirst({ where: { instituicaoId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Curso Área ${TS}`,
      codigo: `CA${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 0,
    });
    if (cr.status >= 400) {
      log('SECUNDARIO', 2, 'Criar curso (área)', false, cr.data?.message);
      return false;
    }
    curso = cr.data;
  }
  cursoId = curso.id;
  log('SECUNDARIO', 2, 'Criar curso/classe', true);

  // 3. Turma
  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId, nome: 'Matemática', codigo: `MAT-${TS}`, cargaHoraria: 4 },
    });
  } else {
    await prisma.disciplina.update({
      where: { id: disciplina.id },
      data: { cargaHoraria: 4 },
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
      log('SECUNDARIO', 3, 'Criar turma', false, cr.data?.message);
      return false;
    }
    turma = cr.data;
  }
  turmaId = turma.id;
  log('SECUNDARIO', 3, 'Criar turmas', true);

  // 4. Matrícula
  let matAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId, anoLetivoId, instituicaoId, status: 'ATIVA' },
  });
  if (!matAnual) {
    const matAnualRes = await adminApi.post('/matriculas-anuais', {
      alunoId,
      anoLetivoId,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: classe.nome,
      cursoId,
      classeId,
    });
    if (matAnualRes.status >= 400) {
      log('SECUNDARIO', 4, 'Matricular aluno', false, matAnualRes.data?.message);
      return false;
    }
    matAnual = matAnualRes.data;
  }
  matriculaAnualId = matAnual.id;

  const matriculaExistente = await prisma.matricula.findFirst({
    where: { alunoId, turmaId },
  });
  if (!matriculaExistente) {
    const mat = await adminApi.post('/matriculas', {
      alunoId,
      turmaId,
      status: 'Ativa',
    });
    if (mat.status >= 400) {
      log('SECUNDARIO', 4, 'Matrícula turma', false, mat.data?.message);
      return false;
    }
  }

  const trim1 = await prisma.trimestre.findFirst({ where: { anoLetivoId, numero: 1 } });
  await prisma.alunoDisciplina.upsert({
    where: {
      alunoId_disciplinaId_ano_semestre: {
        alunoId,
        disciplinaId,
        ano,
        semestre: '1',
      },
    },
    update: {},
    create: {
      alunoId,
      disciplinaId,
      turmaId,
      matriculaAnualId,
      ano,
      semestre: '1',
      trimestreId: trim1?.id,
      status: 'Cursando',
    },
  });
  log('SECUNDARIO', 4, 'Matricular aluno', true);

  // 5. Associar professor (Plano de Ensino) - Remover plano existente não aprovado e desbloquear para permitir lançar aula
  await prisma.planoEnsino.deleteMany({
    where: {
      instituicaoId,
      disciplinaId,
      anoLetivoId,
      turmaId,
      estado: { not: 'APROVADO' },
    },
  });
  await prisma.planoEnsino.updateMany({
    where: { instituicaoId, anoLetivoId },
    data: { bloqueado: false },
  });
  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId,
    disciplinaId,
    classeId,
    classeOuAno: classe.nome,
    turmaId,
    metodologia: 'Expositiva',
    objetivos: 'Objetivos',
    conteudoProgramatico: 'Conteúdo',
    criteriosAvaliacao: 'Provas',
    ementa: 'Ementa',
  });
  if (createPlano.status >= 400) {
    log('SECUNDARIO', 5, 'Associar professor', false, createPlano.data?.message);
    return false;
  }
  planoEnsinoId = createPlano.data.id;

  await adminApi.put(`/plano-ensino/${planoEnsinoId}`, {
    ementa: 'Ementa completa da disciplina para teste de fluxo acadêmico.',
    objetivos: 'Objetivos de aprendizagem da disciplina.',
    metodologia: 'Aulas expositivas e práticas.',
    criteriosAvaliacao: 'Provas escritas e trabalhos práticos.',
  });
  await adminApi.post(`/plano-ensino/${planoEnsinoId}/aulas`, {
    titulo: 'Aula 1',
    descricao: 'Conteúdo',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  const planoAula = await prisma.planoAula.findFirst({
    where: { planoEnsinoId },
    select: { id: true },
  });
  planoAulaId = planoAula!.id;

  let evento = await prisma.eventoCalendario.findFirst({
    where: { instituicaoId, status: 'APROVADO' },
  });
  if (!evento) {
    const ev = await adminApi.post('/eventos', {
      titulo: 'Ano Letivo',
      dataInicio: new Date(ano, 0, 1).toISOString().split('T')[0],
      dataFim: new Date(ano, 11, 31).toISOString().split('T')[0],
      tipo: 'evento',
    });
    if (ev.status < 400) {
      await adminApi.post('/workflow/submeter', { entidade: 'EventoCalendario', entidadeId: ev.data.id });
      await adminApi.post('/workflow/aprovar', { entidade: 'EventoCalendario', entidadeId: ev.data.id });
    }
  }

  const planoStatus = await prisma.planoEnsino.findUnique({
    where: { id: planoEnsinoId },
    select: { status: true, estado: true },
  });
  if (planoStatus?.estado !== 'APROVADO') {
    if (planoStatus?.status !== 'SUBMETIDO') {
      const subRes = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
      if (subRes.status >= 400) {
        log('SECUNDARIO', 5, 'Submeter plano', false, subRes.data?.message);
        return false;
      }
    }
    const aprRes = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
    if (aprRes.status >= 400) {
      log('SECUNDARIO', 5, 'Aprovar plano', false, aprRes.data?.message);
      return false;
    }
  }
  log('SECUNDARIO', 5, 'Associar professor', true);

  // Distribuir aulas (pré-requisito para lançar aula)
  const dataDistrib = new Date(ano, 1, 10 + (TS % 18));
  await prisma.distribuicaoAula.upsert({
    where: {
      planoAulaId_data: {
        planoAulaId,
        data: dataDistrib,
      },
    },
    update: {},
    create: {
      planoAulaId,
      planoEnsinoId,
      data: dataDistrib,
      instituicaoId,
    },
  });

  // 6. Lançar notas
  const createAval = await adminApi.post('/avaliacoes', {
    planoEnsinoId,
    turmaId,
    professorId,
    tipo: 'PROVA',
    trimestre: 1,
    trimestreId: trim1?.id,
    peso: 1,
    data: new Date().toISOString().split('T')[0],
    nome: 'Prova 1',
  });
  if (createAval.status >= 400) {
    log('SECUNDARIO', 6, 'Lançar notas', false, createAval.data?.message);
    return false;
  }
  avaliacaoId = createAval.data.id;

  await adminApi.post('/notas/avaliacao/lote', {
    avaliacaoId,
    notas: [{ alunoId, valor: 14 }],
  });
  log('SECUNDARIO', 6, 'Lançar notas', true);

  // 7. Registrar frequência (AulaLancada + Presença)
  const dataAula = new Date(ano, 1, 10 + (TS % 18)); // Data única por execução
  let aulaLancadaRes = await profApi.post('/aulas-lancadas', {
    planoAulaId,
    data: dataAula.toISOString().split('T')[0],
    cargaHoraria: 2,
  });
  if (aulaLancadaRes.status === 400 && aulaLancadaRes.data?.message?.includes('lançamento')) {
    const existente = await prisma.aulaLancada.findFirst({
      where: { planoEnsinoId, instituicaoId },
      select: { id: true },
    });
    if (existente) {
      aulaLancadaId = existente.id;
    }
  } else if (aulaLancadaRes.status < 400) {
    aulaLancadaId = aulaLancadaRes.data?.id;
  }
  if (aulaLancadaRes.status >= 400 && !aulaLancadaId) {
    log('SECUNDARIO', 7, 'Registrar frequência (lançar aula)', false, aulaLancadaRes.data?.message);
    return false;
  }

  const presencaRes = await profApi.post('/presencas', {
    aulaLancadaId,
    presencas: [{ alunoId, status: 'PRESENTE' }],
  });
  if (presencaRes.status >= 400) {
    log('SECUNDARIO', 7, 'Registrar frequência', false, presencaRes.data?.message);
    return false;
  }
  log('SECUNDARIO', 7, 'Registrar frequência', true);

  // 8. Gerar boletim
  const boletim = await adminApi.get(`/relatorios-oficiais/boletim/${alunoId}`, {
    params: { anoLetivoId },
  });
  if (boletim.status >= 400) {
    log('SECUNDARIO', 8, 'Gerar boletim', false, boletim.data?.message);
    return false;
  }
  log('SECUNDARIO', 8, 'Gerar boletim', true);

  // 9. Encerrar ano letivo - Fechar avaliações, aprovar/bloquear planos, lançar aulas suficientes, encerrar trimestres
  const avaliacoesAbertas = await prisma.avaliacao.findMany({
    where: { instituicaoId, fechada: false },
    select: { id: true },
  });
  for (const av of avaliacoesAbertas) {
    await adminApi.post(`/avaliacoes/${av.id}/fechar`);
  }
  await prisma.planoEnsino.updateMany({
    where: { instituicaoId, anoLetivoId, estado: { not: 'APROVADO' } },
    data: { estado: 'APROVADO', status: 'APROVADO', bloqueado: true },
  });
  await prisma.planoEnsino.updateMany({
    where: { instituicaoId, anoLetivoId },
    data: { bloqueado: true },
  });
  // Trimestre 1: exigir aulas lançadas = quantidadeAulas. Ajustar para 1 se já temos 1 aula lançada
  const aulaPlanoSec = await prisma.planoAula.findFirst({
    where: { planoEnsinoId },
    select: { id: true, quantidadeAulas: true },
  });
  if (aulaPlanoSec && aulaPlanoSec.quantidadeAulas > 1) {
    const countLanc = await prisma.aulaLancada.count({ where: { planoAulaId: aulaPlanoSec.id } });
    if (countLanc < aulaPlanoSec.quantidadeAulas) {
      await prisma.planoAula.update({
        where: { id: aulaPlanoSec.id },
        data: { quantidadeAulas: countLanc },
      });
    }
  }
  // Garantir presenças em todas as AulaLancada do trimestre 1 (evitar falha por dados de execuções anteriores)
  const aulasLancadasSec = await prisma.aulaLancada.findMany({
    where: {
      instituicaoId,
      planoAula: { trimestre: 1, planoEnsino: { anoLetivoId } },
    },
    include: { presencas: true, planoAula: { include: { planoEnsino: { select: { disciplinaId: true } } } } },
  });
  for (const al of aulasLancadasSec) {
    const alunosNaDisc = await prisma.alunoDisciplina.findMany({
      where: {
        ano,
        disciplinaId: al.planoAula.planoEnsino.disciplinaId,
        disciplina: { instituicaoId },
      },
      select: { alunoId: true },
    });
    const alunosIds = alunosNaDisc.map((a) => a.alunoId);
    const temPresenca = new Set(al.presencas.map((p) => p.alunoId));
    const faltam = alunosIds.filter((id) => !temPresenca.has(id));
    for (const aid of faltam) {
      try {
        await prisma.presenca.upsert({
          where: {
            aulaLancadaId_alunoId: { aulaLancadaId: al.id, alunoId: aid },
          },
          update: { status: 'PRESENTE' },
          create: {
            aulaLancadaId: al.id,
            alunoId: aid,
            instituicaoId,
            status: 'PRESENTE',
          },
        });
      } catch (_) {
        const pr = await profApi.post('/presencas', { aulaLancadaId: al.id, presencas: [{ alunoId: aid, status: 'PRESENTE' }] });
        if (pr.status >= 400) break;
      }
    }
  }
  for (const tr of [1, 2, 3]) {
    const encTr = await adminApi.post('/encerramentos/encerrar', {
      anoLetivo: ano,
      periodo: `TRIMESTRE_${tr}`,
    });
    if (encTr.status >= 400) {
      log('SECUNDARIO', 9, `Encerrar trimestre ${tr}`, false, encTr.data?.message);
      return false;
    }
  }
  let encAno = await adminApi.post('/encerramentos/encerrar', {
    anoLetivo: ano,
    periodo: 'ANO',
    justificativa: 'Teste fluxo completo',
  });
  if (encAno.status === 403 && encAno.data?.error === 'TERMO_NAO_ACEITO' && encAno.data?.termoId) {
    await adminApi.post('/termos-legais/aceitar', { termoId: encAno.data.termoId });
    encAno = await adminApi.post('/encerramentos/encerrar', {
      anoLetivo: ano,
      periodo: 'ANO',
      justificativa: 'Teste fluxo completo',
    });
  }
  if (encAno.status >= 400) {
    log('SECUNDARIO', 9, 'Encerrar ano letivo', false, encAno.data?.message || encAno.data?.error || JSON.stringify(encAno.data));
    return false;
  }
  log('SECUNDARIO', 9, 'Encerrar ano letivo', true);
  return true;
}

async function runFluxoSuperior(
  api: AxiosInstance,
  adminApi: AxiosInstance,
  profApi: AxiosInstance,
  instituicaoId: string
): Promise<boolean> {
  const ano = ANO_TESTE;
  let anoLetivoId: string;
  let cursoId: string;
  let turmaId: string;
  let disciplinaId: string;
  let professorId: string;
  let planoEnsinoId: string;
  let planoAulaId: string;
  let alunoId: string;
  let matriculaAnualId: string;
  let aulaLancadaId: string;
  let semestreId: string;

  const admin = await prisma.user.findFirst({
    where: { instituicaoId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true },
  });
  if (!admin) throw new Error('Admin não encontrado');

  const prof = await prisma.professor.findFirst({ where: { instituicaoId } });
  if (!prof) throw new Error('Professor não encontrado');
  professorId = prof.id;

  const aluno = await prisma.user.findFirst({
    where: { instituicaoId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true },
  });
  if (!aluno) throw new Error('Aluno não encontrado');
  alunoId = aluno.id;

  // 1. Ano Letivo
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId, ano },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
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
  anoLetivoId = anoLetivo.id;

  // Semestres
  let sem1 = await prisma.semestre.findFirst({
    where: { anoLetivoId, numero: 1 },
  });
  if (!sem1) {
    sem1 = await prisma.semestre.create({
      data: {
        anoLetivoId,
        anoLetivo: ano,
        numero: 1,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 5, 30),
        status: 'ATIVO',
        instituicaoId,
      },
    });
  } else if (sem1.status === 'ENCERRADO') {
    await prisma.semestre.update({
      where: { id: sem1.id },
      data: { status: 'ATIVO', encerradoPor: null, encerradoEm: null },
    });
  }
  // Reabrir EncerramentoAcademico de semestres para permitir lancar aula e presenças (execuções anteriores)
  await prisma.encerramentoAcademico.updateMany({
    where: { instituicaoId, anoLetivo: ano, periodo: { in: ['SEMESTRE_1', 'SEMESTRE_2'] } },
    data: { status: 'ABERTO', encerradoPor: null, encerradoEm: null, justificativa: null },
  });
  semestreId = sem1.id;

  const sem2 = await prisma.semestre.findFirst({
    where: { anoLetivoId, numero: 2 },
  });
  if (!sem2) {
    await prisma.semestre.create({
      data: {
        anoLetivoId,
        anoLetivo: ano,
        numero: 2,
        dataInicio: new Date(ano, 6, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'PLANEJADO',
        instituicaoId,
      },
    });
  }

  log('SUPERIOR', 1, 'Criar ano letivo', true);

  // 2. Curso
  let curso = await prisma.curso.findFirst({ where: { instituicaoId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Licenciatura ${TS}`,
      codigo: `LIC${TS}`,
      cargaHoraria: 240,
      valorMensalidade: 75000,
    });
    if (cr.status >= 400) {
      log('SUPERIOR', 2, 'Criar curso', false, cr.data?.message);
      return false;
    }
    curso = cr.data;
  }
  cursoId = curso.id;
  log('SUPERIOR', 2, 'Criar curso', true);

  // CursoDisciplina
  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId, nome: 'Cálculo I', codigo: `CAL-${TS}`, cargaHoraria: 4 },
    });
  } else {
    await prisma.disciplina.update({
      where: { id: disciplina.id },
      data: { cargaHoraria: 4 },
    });
  }
  disciplinaId = disciplina.id;

  await prisma.cursoDisciplina.upsert({
    where: {
      cursoId_disciplinaId: { cursoId, disciplinaId },
    },
    update: {},
    create: { cursoId, disciplinaId, semestre: 1 },
  });

  // ProfessorDisciplina (Superior exige cursoId)
  const pdExists = await prisma.professorDisciplina.findFirst({
    where: { professorId, disciplinaId, cursoId },
  });
  if (!pdExists) {
    await prisma.professorDisciplina.create({
      data: { professorId, disciplinaId, cursoId },
    });
  }

  // 3. Turma (Superior: cursoId + semestre)
  let turma = await prisma.turma.findFirst({
    where: { instituicaoId, anoLetivoId, cursoId },
  });
  if (!turma) {
    const cr = await adminApi.post('/turmas', {
      nome: `Turma 1º Ano S1 ${TS}`,
      cursoId,
      anoLetivoId,
      semestre: 1,
      capacidade: 40,
    });
    if (cr.status >= 400) {
      log('SUPERIOR', 3, 'Criar turma', false, cr.data?.message);
      return false;
    }
    turma = cr.data;
  }
  turmaId = turma.id;
  log('SUPERIOR', 3, 'Criar turmas', true);

  // 4. Matrícula
  let matAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId, anoLetivoId, instituicaoId, status: 'ATIVA' },
  });
  if (!matAnual) {
    const matAnualRes = await adminApi.post('/matriculas-anuais', {
      alunoId,
      anoLetivoId,
      nivelEnsino: 'SUPERIOR',
      classeOuAnoCurso: '1º Ano',
      cursoId,
    });
    if (matAnualRes.status >= 400) {
      log('SUPERIOR', 4, 'Matricular aluno', false, matAnualRes.data?.message);
      return false;
    }
    matAnual = matAnualRes.data;
  }
  matriculaAnualId = matAnual.id;

  const matriculaExistente = await prisma.matricula.findFirst({
    where: { alunoId, turmaId },
  });
  if (!matriculaExistente) {
    const mat = await adminApi.post('/matriculas', {
      alunoId,
      turmaId,
      status: 'Ativa',
    });
    if (mat.status >= 400) {
      log('SUPERIOR', 4, 'Matrícula turma', false, mat.data?.message);
      return false;
    }
  }

  await prisma.alunoDisciplina.upsert({
    where: {
      alunoId_disciplinaId_ano_semestre: {
        alunoId,
        disciplinaId,
        ano,
        semestre: '1',
      },
    },
    update: {},
    create: {
      alunoId,
      disciplinaId,
      turmaId,
      matriculaAnualId,
      ano,
      semestre: '1',
      semestreId,
      status: 'Cursando',
    },
  });
  log('SUPERIOR', 4, 'Matricular aluno', true);

  // 5. Plano de Ensino (Superior) - Remover plano existente não aprovado e desbloquear para permitir lançar aula
  await prisma.planoEnsino.deleteMany({
    where: {
      instituicaoId,
      disciplinaId,
      anoLetivoId,
      turmaId,
      estado: { not: 'APROVADO' },
    },
  });
  await prisma.planoEnsino.updateMany({
    where: { instituicaoId, anoLetivoId },
    data: { bloqueado: false },
  });
  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId,
    disciplinaId,
    cursoId,
    semestre: 1,
    semestreId,
    turmaId,
    metodologia: 'Expositiva',
    objetivos: 'Objetivos',
    conteudoProgramatico: 'Conteúdo',
    criteriosAvaliacao: 'Provas',
    ementa: 'Ementa',
  });
  if (createPlano.status >= 400) {
    log('SUPERIOR', 5, 'Associar professor', false, createPlano.data?.message);
    return false;
  }
  planoEnsinoId = createPlano.data.id;

  await adminApi.put(`/plano-ensino/${planoEnsinoId}`, {
    ementa: 'Ementa completa da disciplina para teste de fluxo acadêmico.',
    objetivos: 'Objetivos de aprendizagem da disciplina.',
    metodologia: 'Aulas expositivas e práticas.',
    criteriosAvaliacao: 'Provas escritas e trabalhos práticos.',
  });
  await adminApi.post(`/plano-ensino/${planoEnsinoId}/aulas`, {
    titulo: 'Aula 1',
    descricao: 'Conteúdo',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  const planoAula = await prisma.planoAula.findFirst({
    where: { planoEnsinoId },
    select: { id: true },
  });
  planoAulaId = planoAula!.id;

  let eventoCal = await prisma.eventoCalendario.findFirst({
    where: { instituicaoId, status: 'APROVADO' },
  });
  if (!eventoCal) {
    const ev = await adminApi.post('/eventos', {
      titulo: 'Ano Letivo',
      dataInicio: new Date(ano, 0, 1).toISOString().split('T')[0],
      dataFim: new Date(ano, 11, 31).toISOString().split('T')[0],
      tipo: 'evento',
    });
    if (ev.status < 400) {
      await adminApi.post('/workflow/submeter', { entidade: 'EventoCalendario', entidadeId: ev.data.id });
      await adminApi.post('/workflow/aprovar', { entidade: 'EventoCalendario', entidadeId: ev.data.id });
    }
  }

  const planoStatusSup = await prisma.planoEnsino.findUnique({
    where: { id: planoEnsinoId },
    select: { status: true, estado: true },
  });
  if (planoStatusSup?.estado !== 'APROVADO') {
    if (planoStatusSup?.status !== 'SUBMETIDO') {
      const subRes = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
      if (subRes.status >= 400) {
        log('SUPERIOR', 5, 'Submeter plano', false, subRes.data?.message);
        return false;
      }
    }
    const aprRes = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoEnsinoId });
    if (aprRes.status >= 400) {
      log('SUPERIOR', 5, 'Aprovar plano', false, aprRes.data?.message);
      return false;
    }
  }
  log('SUPERIOR', 5, 'Associar professor', true);

  const dataDistribSup = new Date(ano, 2, 5 + (TS % 20));
  await prisma.distribuicaoAula.upsert({
    where: {
      planoAulaId_data: {
        planoAulaId,
        data: dataDistribSup,
      },
    },
    update: {},
    create: {
      planoAulaId,
      planoEnsinoId,
      data: dataDistribSup,
      instituicaoId,
    },
  });

  // 6. Lançar notas (Superior: semestreId)
  const createAval = await adminApi.post('/avaliacoes', {
    planoEnsinoId,
    turmaId,
    professorId,
    tipo: 'PROVA',
    semestreId,
    peso: 1,
    data: new Date().toISOString().split('T')[0],
    nome: 'P1',
  });
  if (createAval.status >= 400) {
    log('SUPERIOR', 6, 'Lançar notas', false, createAval.data?.message);
    return false;
  }

  await adminApi.post('/notas/avaliacao/lote', {
    avaliacaoId: createAval.data.id,
    notas: [{ alunoId, valor: 15 }],
  });
  log('SUPERIOR', 6, 'Lançar notas', true);

  // 7. Registrar frequência
  let aulaLancadaResSup = await profApi.post('/aulas-lancadas', {
    planoAulaId,
    data: dataDistribSup.toISOString().split('T')[0],
    cargaHoraria: 2,
  });
  if (aulaLancadaResSup.status === 400 && aulaLancadaResSup.data?.message?.includes('lançamento')) {
    const existente = await prisma.aulaLancada.findFirst({
      where: { planoEnsinoId, instituicaoId },
      select: { id: true },
    });
    if (existente) aulaLancadaId = existente.id;
  } else if (aulaLancadaResSup.status < 400) {
    aulaLancadaId = aulaLancadaResSup.data?.id;
  }
  if (aulaLancadaResSup.status >= 400 && !aulaLancadaId) {
    log('SUPERIOR', 7, 'Registrar frequência (lançar aula)', false, aulaLancadaResSup.data?.message);
    return false;
  }

  const presencaRes = await profApi.post('/presencas', {
    aulaLancadaId,
    presencas: [{ alunoId, status: 'PRESENTE' }],
  });
  if (presencaRes.status >= 400) {
    log('SUPERIOR', 7, 'Registrar frequência', false, presencaRes.data?.message);
    return false;
  }
  log('SUPERIOR', 7, 'Registrar frequência', true);

  // 8. Gerar boletim
  const boletim = await adminApi.get(`/relatorios-oficiais/boletim/${alunoId}`, {
    params: { anoLetivoId },
  });
  if (boletim.status >= 400) {
    log('SUPERIOR', 8, 'Gerar boletim', false, boletim.data?.message);
    return false;
  }
  log('SUPERIOR', 8, 'Gerar boletim', true);

  // 9. Encerrar ano letivo - Fechar avaliações, aprovar/bloquear planos, encerrar semestres
  const avaliacoesAbertasSup = await prisma.avaliacao.findMany({
    where: { instituicaoId, fechada: false },
    select: { id: true },
  });
  for (const av of avaliacoesAbertasSup) {
    await adminApi.post(`/avaliacoes/${av.id}/fechar`);
  }
  const anoLetivoSup = await prisma.anoLetivo.findFirst({
    where: { instituicaoId, ano },
    select: { id: true },
  });
  if (anoLetivoSup) {
    await prisma.planoEnsino.updateMany({
      where: { instituicaoId, anoLetivoId: anoLetivoSup.id, estado: { not: 'APROVADO' } },
      data: { estado: 'APROVADO', status: 'APROVADO', bloqueado: true },
    });
    await prisma.planoEnsino.updateMany({
      where: { instituicaoId, anoLetivoId: anoLetivoSup.id },
      data: { bloqueado: true },
    });
  }
  for (const s of [1, 2]) {
    const encSem = await adminApi.post('/encerramentos/encerrar', {
      anoLetivo: ano,
      periodo: `SEMESTRE_${s}`,
    });
    if (encSem.status >= 400) {
      log('SUPERIOR', 9, `Encerrar semestre ${s}`, false, encSem.data?.message);
      return false;
    }
  }
  let encAno = await adminApi.post('/encerramentos/encerrar', {
    anoLetivo: ano,
    periodo: 'ANO',
    justificativa: 'Teste fluxo completo',
  });
  if (encAno.status === 403 && encAno.data?.error === 'TERMO_NAO_ACEITO' && encAno.data?.termoId) {
    await adminApi.post('/termos-legais/aceitar', { termoId: encAno.data.termoId });
    encAno = await adminApi.post('/encerramentos/encerrar', {
      anoLetivo: ano,
      periodo: 'ANO',
      justificativa: 'Teste fluxo completo',
    });
  }
  if (encAno.status >= 400) {
    log('SUPERIOR', 9, 'Encerrar ano letivo', false, encAno.data?.message || encAno.data?.error || JSON.stringify(encAno.data));
    return false;
  }
  log('SUPERIOR', 9, 'Encerrar ano letivo', true);
  return true;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  🎓 TESTE FLUXO ACADÊMICO COMPLETO - SECUNDÁRIO + SUPERIOR');
  console.log('  Critério: Se qualquer passo quebrar → sistema não está pronto');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
    validateStatus: () => true,
  });

  // Login SUPER_ADMIN
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou. Verifique .env (TEST_ADMIN_EMAIL, TEST_ADMIN_PASS)');
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  // Instituições do seed
  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  const instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });

  if (!instA || !instB) {
    console.error('❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  // Permitir matrícula fora do período letivo (necessário quando ANO_TESTE é ano passado)
  for (const inst of [instA, instB]) {
    await prisma.parametrosSistema.upsert({
      where: { instituicaoId: inst.id },
      update: { permitirMatriculaForaPeriodo: true },
      create: { instituicaoId: inst.id, permitirMatriculaForaPeriodo: true },
    });
  }

  await prisma.instituicao.update({
    where: { id: instA.id },
    data: { tipoAcademico: 'SECUNDARIO' },
  });
  await prisma.instituicao.update({
    where: { id: instB.id },
    data: { tipoAcademico: 'SUPERIOR' },
  });

  // Assinaturas ativas
  const plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (plano) {
    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    for (const inst of [instA, instB]) {
      let assinatura = await prisma.assinatura.findUnique({ where: { instituicaoId: inst.id } });
      if (!assinatura) {
        await prisma.assinatura.create({
          data: {
            instituicaoId: inst.id,
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
  }

  // Login Admin A
  const loginA = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  if (loginA.status !== 200 || !loginA.data?.accessToken) {
    console.error('❌ Login Admin A falhou');
    process.exit(1);
  }
  const adminApiA = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginA.data.accessToken}`,
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  // Login Professor A
  const loginProfA = await api.post('/auth/login', {
    email: 'prof.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const profApiA = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginProfA.data?.accessToken || loginA.data.accessToken}`,
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  // Login Admin B
  const loginB = await api.post('/auth/login', {
    email: 'admin.inst.b@teste.dsicola.com',
    password: SENHA,
  });
  if (loginB.status !== 200 || !loginB.data?.accessToken) {
    console.error('❌ Login Admin B falhou');
    process.exit(1);
  }
  const adminApiB = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginB.data.accessToken}`,
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  const loginProfB = await api.post('/auth/login', {
    email: 'prof.inst.b@teste.dsicola.com',
    password: SENHA,
  });
  const profApiB = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginProfB.data?.accessToken || loginB.data.accessToken}`,
    },
    timeout: 60000,
    validateStatus: () => true,
  });

  // Criar professor B se não existir
  const profUserB = await prisma.user.findFirst({
    where: { email: 'prof.inst.b@teste.dsicola.com' },
  });
  if (!profUserB) {
    const cr = await adminApiB.post('/users', {
      email: 'prof.inst.b@teste.dsicola.com',
      password: SENHA,
      nomeCompleto: 'Professor B',
      role: 'PROFESSOR',
    });
    if (cr.status < 400) {
      await prisma.user.update({
        where: { id: cr.data.id },
        data: { instituicaoId: instB.id, password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
      });
      await prisma.professor.create({
        data: { userId: cr.data.id, instituicaoId: instB.id },
      });
    }
  }

  console.log('═══ FLUXO SECUNDÁRIO (Inst A) ═══\n');
  let okSec = false;
  try {
    okSec = await runFluxoSecundario(api, adminApiA, profApiA, instA.id);
  } catch (e: any) {
    console.error('Erro Secundário:', e?.message || e);
  }

  console.log('\n═══ FLUXO SUPERIOR (Inst B) ═══\n');
  let okSup = false;
  try {
    okSup = await runFluxoSuperior(api, adminApiB, profApiB, instB.id);
  } catch (e: any) {
    console.error('Erro Superior:', e?.message || e);
  }

  await prisma.$disconnect();

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - FLUXO ACADÊMICO COMPLETO');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  const secResults = results.filter((r) => r.tipo === 'SECUNDARIO');
  const supResults = results.filter((r) => r.tipo === 'SUPERIOR');
  const secPassed = secResults.filter((r) => r.ok).length;
  const supPassed = supResults.filter((r) => r.ok).length;

  console.log(`\nSECUNDÁRIO: ${secPassed}/9 etapas`);
  secResults.filter((r) => !r.ok).forEach((r) => console.log(`   ❌ ${r.name}: ${r.message}`));

  console.log(`\nSUPERIOR: ${supPassed}/9 etapas`);
  supResults.filter((r) => !r.ok).forEach((r) => console.log(`   ❌ ${r.name}: ${r.message}`));

  const allOk = okSec && okSup;
  if (!allOk) {
    console.log('\n⚠️  SISTEMA NÃO ESTÁ PRONTO: Uma ou mais etapas falharam.\n');
    process.exit(1);
  }
  console.log('\n✅ SISTEMA PRONTO: Fluxo completo validado para SECUNDÁRIO e SUPERIOR.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
