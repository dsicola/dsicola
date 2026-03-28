#!/usr/bin/env npx tsx
/**
 * TESTE E2E: Módulo académico (secundário) — curso, turmas, estudantes, conclusão do ciclo e certificado.
 *
 * Cenário:
 * - Instituição isolada com 1 disciplina obrigatória e classes 10–12 (ciclo completo).
 * - Estudante A: histórico 10+11+12 (APROVADO) → solicitação → conclusão oficial → certificado + verificação pública.
 * - Estudante B: só 10+11 (no meio do percurso) → validação e solicitação para 12.ª falham.
 * - Motor académico: próxima classe; avaliar matrícula anual do estudante B.
 *
 * Pré-requisitos: Postgres + API (default http://localhost:3001).
 *
 * Uso:
 *   npx tsx scripts/test-modulo-academico-conclusao-certificado.ts
 *   npm run test:modulo-academico-conclusao --prefix backend
 */

import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = `AcadMod${Date.now().toString(36)}!`;

interface Step {
  id: string;
  ok: boolean;
  detail?: string;
}

const steps: Step[] = [];

function record(id: string, ok: boolean, detail?: string) {
  steps.push({ id, ok, detail });
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${id}${detail ? `: ${detail}` : ''}`);
}

function printSummary() {
  console.log('\n──────────────────────────────────────────────────────────────────────');
  const ok = steps.filter((s) => s.ok).length;
  const bad = steps.filter((s) => !s.ok).length;
  console.log(`  Resultado: ${ok} OK, ${bad} falhas`);
  console.log('──────────────────────────────────────────────────────────────────────\n');
}

async function ensurePlanoAssinatura(instituicaoId: string) {
  let plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!plano) {
    plano = await prisma.plano.create({
      data: {
        nome: 'Plano E2E Académico',
        descricao: 'Testes módulo académico',
        valorMensal: 0,
        limiteAlunos: 500,
        limiteProfessores: 50,
        limiteCursos: 30,
        ativo: true,
      },
    });
  }
  const dataFim = new Date();
  dataFim.setFullYear(dataFim.getFullYear() + 1);
  const ass = await prisma.assinatura.findUnique({ where: { instituicaoId } });
  if (!ass) {
    await prisma.assinatura.create({
      data: {
        instituicaoId,
        planoId: plano.id,
        status: 'ativa',
        tipo: 'PAGA',
        dataFim,
        dataProximoPagamento: dataFim,
        valorAtual: 0,
      },
    });
  } else if (ass.status !== 'ativa') {
    await prisma.assinatura.update({
      where: { id: ass.id },
      data: { status: 'ativa', dataFim },
    });
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  E2E — Módulo académico: conclusão de ciclo + certificado (secundário)');
  console.log('══════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const probe = axios.create({ baseURL: API_URL, timeout: 5000, validateStatus: () => true });
  try {
    const h = await probe.get('/health');
    if (h.status !== 200) {
      console.error(`❌ GET /health retornou ${h.status}. Inicie o backend em ${API_URL}`);
      process.exit(1);
    }
  } catch {
    console.error(`❌ Não foi possível ligar a ${API_URL}. Inicie o backend (ex.: npm run dev).`);
    process.exit(1);
  }

  const slug = `acad-e2e-${Date.now()}`;
  const inst = await prisma.instituicao.create({
    data: {
      nome: `Instituição Teste ${slug}`,
      subdominio: slug,
      tipoInstituicao: 'ENSINO_MEDIO',
      tipoAcademico: 'SECUNDARIO',
      status: 'ativa',
    },
  });

  await ensurePlanoAssinatura(inst.id);

  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: inst.id },
    create: {
      instituicaoId: inst.id,
      percentualMinimoAprovacao: new Prisma.Decimal(10),
    },
    update: {
      percentualMinimoAprovacao: new Prisma.Decimal(10),
    },
  });

  const curso = await prisma.curso.create({
    data: {
      instituicaoId: inst.id,
      nome: 'Ensino Secundário Geral (E2E)',
      codigo: `E2E-${slug.slice(-6)}`,
      valorMensalidade: 0,
      /** Alinhado com 1 disciplina obrigatória (60h); validação de conclusão usa curso.cargaHoraria quando há cursoId. */
      cargaHoraria: 60,
    },
  });

  const mkClasse = (nome: string, ordem: number, codigo: string, ch: number) =>
    prisma.classe.create({
      data: {
        instituicaoId: inst.id,
        nome,
        codigo,
        ordem,
        cargaHoraria: ch,
        ativo: true,
      },
    });

  const [c10, c11, c12] = await Promise.all([
    mkClasse('10ª Classe', 10, 'E2E10', 0),
    mkClasse('11ª Classe', 11, 'E2E11', 0),
    mkClasse('12ª Classe', 12, 'E2E12', 60),
  ]);

  const disciplina = await prisma.disciplina.create({
    data: {
      instituicaoId: inst.id,
      cursoId: curso.id,
      nome: 'Língua Portuguesa (E2E)',
      codigo: 'LP-E2E',
      cargaHoraria: 60,
      obrigatoria: true,
      ativa: true,
    },
  });

  await prisma.cursoDisciplina.create({
    data: { cursoId: curso.id, disciplinaId: disciplina.id, classeId: null },
  });

  const turno = await prisma.turno.create({
    data: { instituicaoId: inst.id, nome: 'Manhã' },
  });

  const baseY = new Date().getFullYear() - 8;

  const ae1 = await prisma.anoLetivo.create({
    data: {
      instituicaoId: inst.id,
      ano: baseY,
      status: 'ENCERRADO',
      dataInicio: new Date(baseY, 0, 1),
      dataFim: new Date(baseY, 11, 20),
    },
  });
  const ae2 = await prisma.anoLetivo.create({
    data: {
      instituicaoId: inst.id,
      ano: baseY + 1,
      status: 'ENCERRADO',
      dataInicio: new Date(baseY + 1, 0, 1),
      dataFim: new Date(baseY + 1, 11, 20),
    },
  });
  const ae3 = await prisma.anoLetivo.create({
    data: {
      instituicaoId: inst.id,
      ano: baseY + 2,
      status: 'ENCERRADO',
      dataInicio: new Date(baseY + 2, 0, 1),
      dataFim: new Date(baseY + 2, 11, 20),
    },
  });
  const anoAtivo = await prisma.anoLetivo.create({
    data: {
      instituicaoId: inst.id,
      ano: baseY + 3,
      status: 'ATIVO',
      dataInicio: new Date(baseY + 3, 0, 1),
      dataFim: new Date(baseY + 3, 11, 31),
      ativadoEm: new Date(),
    },
  });

  const hash = await bcrypt.hash(SENHA, 10);

  const admin = await prisma.user.create({
    data: {
      email: `admin.${slug}@e2e.dsicola.local`,
      password: hash,
      nomeCompleto: 'Admin E2E Académico',
      instituicaoId: inst.id,
      mustChangePassword: false,
      onboardingConcluido: true,
      onboardingConcluidoEm: new Date(),
    },
  });
  await prisma.userRole_.create({
    data: { userId: admin.id, role: 'ADMIN', instituicaoId: inst.id },
  });

  const profUser = await prisma.user.create({
    data: {
      email: `prof.${slug}@e2e.dsicola.local`,
      password: hash,
      nomeCompleto: 'Professor E2E',
      instituicaoId: inst.id,
      mustChangePassword: false,
      onboardingConcluido: true,
    },
  });
  await prisma.userRole_.create({
    data: { userId: profUser.id, role: 'PROFESSOR', instituicaoId: inst.id },
  });
  const professor = await prisma.professor.create({
    data: { userId: profUser.id, instituicaoId: inst.id },
  });

  const mkAluno = async (suffix: string) => {
    const u = await prisma.user.create({
      data: {
        email: `aluno.${suffix}.${slug}@e2e.dsicola.local`,
        password: hash,
        nomeCompleto: `Estudante ${suffix}`,
        instituicaoId: inst.id,
        mustChangePassword: false,
        onboardingConcluido: true,
      },
    });
    await prisma.userRole_.create({
      data: { userId: u.id, role: 'ALUNO', instituicaoId: inst.id },
    });
    return u;
  };

  const alunoConclui = await mkAluno('conclui');
  const alunoMeio = await mkAluno('meio');

  async function turmaPara(classeId: string, anoLetivoId: string, nome: string, anoNum: number) {
    return prisma.turma.create({
      data: {
        instituicaoId: inst.id,
        anoLetivoId,
        nome,
        cursoId: curso.id,
        classeId,
        turnoId: turno.id,
        capacidade: 35,
        ano: anoNum,
      },
    });
  }

  const t10a = await turmaPara(c10.id, ae1.id, `${ae1.ano} — 10ª A`, ae1.ano);
  const t11a = await turmaPara(c11.id, ae2.id, `${ae2.ano} — 11ª A`, ae2.ano);
  const t12a = await turmaPara(c12.id, ae3.id, `${ae3.ano} — 12ª A`, ae3.ano);

  const planoBase = {
    instituicaoId: inst.id,
    professorId: professor.id,
    disciplinaId: disciplina.id,
    cursoId: curso.id,
    status: 'APROVADO' as const,
    estado: 'APROVADO' as const,
    bloqueado: false,
  };

  const p10 = await prisma.planoEnsino.create({
    data: {
      ...planoBase,
      classeId: c10.id,
      anoLetivoId: ae1.id,
      anoLetivo: ae1.ano,
      turmaId: t10a.id,
      classeOuAno: c10.nome,
    },
  });
  const p11 = await prisma.planoEnsino.create({
    data: {
      ...planoBase,
      classeId: c11.id,
      anoLetivoId: ae2.id,
      anoLetivo: ae2.ano,
      turmaId: t11a.id,
      classeOuAno: c11.nome,
    },
  });
  const p12 = await prisma.planoEnsino.create({
    data: {
      ...planoBase,
      classeId: c12.id,
      anoLetivoId: ae3.id,
      anoLetivo: ae3.ano,
      turmaId: t12a.id,
      classeOuAno: c12.nome,
    },
  });

  const snap = (
    alunoId: string,
    anoLet: { id: string },
    classeId: string,
    turmaId: string,
    planoId: string,
  ) =>
    prisma.historicoAcademico.create({
      data: {
        instituicaoId: inst.id,
        alunoId,
        anoLetivoId: anoLet.id,
        planoEnsinoId: planoId,
        disciplinaId: disciplina.id,
        cursoId: curso.id,
        classeId,
        turmaId,
        cargaHoraria: 60,
        percentualFrequencia: new Prisma.Decimal(100),
        mediaFinal: new Prisma.Decimal(14),
        situacaoAcademica: 'APROVADO',
      },
    });

  await snap(alunoConclui.id, ae1, c10.id, t10a.id, p10.id);
  await snap(alunoConclui.id, ae2, c11.id, t11a.id, p11.id);
  await snap(alunoConclui.id, ae3, c12.id, t12a.id, p12.id);

  await snap(alunoMeio.id, ae1, c10.id, t10a.id, p10.id);
  await snap(alunoMeio.id, ae2, c11.id, t11a.id, p11.id);

  await prisma.matriculaAnual.create({
    data: {
      alunoId: alunoConclui.id,
      instituicaoId: inst.id,
      anoLetivoId: anoAtivo.id,
      anoLetivo: anoAtivo.ano,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: c12.nome,
      classeId: c12.id,
      cursoId: curso.id,
      status: 'ATIVA',
    },
  });

  const maMeio = await prisma.matriculaAnual.create({
    data: {
      alunoId: alunoMeio.id,
      instituicaoId: inst.id,
      anoLetivoId: anoAtivo.id,
      anoLetivo: anoAtivo.ano,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: c11.nome,
      classeId: c11.id,
      cursoId: curso.id,
      status: 'ATIVA',
    },
  });

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  await prisma.loginAttempt.deleteMany({ where: { email: admin.email.toLowerCase() } });

  const login = await api.post('/auth/login', { email: admin.email, password: SENHA });
  if (login.status !== 200 || !login.data?.accessToken) {
    console.error('Login ADMIN falhou:', login.status, login.data);
    process.exit(1);
  }

  const authHdr = { Authorization: `Bearer ${login.data.accessToken}` };
  const apiAuth: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', ...authHdr },
    timeout: 30000,
    validateStatus: () => true,
  });

  const prox = await apiAuth.get(`/academic/progression/proxima-classe/${c10.id}`);
  record(
    'GET /academic/progression/proxima-classe (10→11)',
    prox.status === 200 && prox.data?.classe?.id === c11.id,
    prox.status !== 200 ? prox.data?.message : undefined,
  );

  const avMeio = await apiAuth.post('/academic/progression/avaliar', {
    matriculaAnualId: maMeio.id,
  });
  record(
    'POST /academic/progression/avaliar (estudante no meio)',
    avMeio.status === 200 && !!avMeio.data?.statusFinal,
    avMeio.status !== 200 ? avMeio.data?.message : undefined,
  );

  const valOk = await apiAuth.get('/conclusoes-cursos/validar', {
    params: { alunoId: alunoConclui.id, classeId: c12.id, cursoId: curso.id },
  });
  record(
    'GET /conclusoes-cursos/validar (percurso completo)',
    valOk.status === 200 && valOk.data?.valido === true,
    valOk.status !== 200 || !valOk.data?.valido ? valOk.data?.erros?.join('; ') : undefined,
  );

  const valMeio12 = await apiAuth.get('/conclusoes-cursos/validar', {
    params: { alunoId: alunoMeio.id, classeId: c12.id, cursoId: curso.id },
  });
  record(
    'GET /conclusoes-cursos/validar (meio → 12.ª inválido)',
    valMeio12.status === 200 && valMeio12.data?.valido === false,
    valMeio12.data?.valido ? 'esperado inválido' : undefined,
  );

  const sol = await apiAuth.post('/conclusoes-cursos', {
    alunoId: alunoConclui.id,
    cursoId: curso.id,
    classeId: c12.id,
    tipoConclusao: 'CONCLUIDO',
  });
  record(
    'POST /conclusoes-cursos (solicitação)',
    sol.status === 201 && sol.data?.id && sol.data?.status === 'VALIDADO',
    sol.data?.message,
  );

  if (sol.status !== 201 || !sol.data?.id) {
    console.error('\nFalha na solicitação — interrompendo.');
    printSummary();
    process.exit(1);
  }

  const concluir = await apiAuth.post(`/conclusoes-cursos/${sol.data.id}/concluir`, {
    numeroAto: `ATO-E2E-${slug}`,
  });
  record(
    'POST /conclusoes-cursos/:id/concluir',
    concluir.status === 200 && concluir.data?.status === 'CONCLUIDO',
    concluir.data?.message,
  );

  const bloqMeio = await apiAuth.post('/conclusoes-cursos', {
    alunoId: alunoMeio.id,
    cursoId: curso.id,
    classeId: c12.id,
  });
  record(
    'POST /conclusoes-cursos (meio na 12.ª rejeitado)',
    bloqMeio.status >= 400,
    bloqMeio.status < 400 ? 'API aceitou indevidamente' : undefined,
  );

  const numCert = `CERT-E2E-${Date.now()}`;
  const cert = await apiAuth.post(`/conclusoes-cursos/${sol.data.id}/certificado`, {
    numeroCertificado: numCert,
    livro: 'L-1',
    folha: 'F-1',
  });
  record(
    'POST /conclusoes-cursos/:id/certificado',
    cert.status === 201 && cert.data?.codigoVerificacao,
    cert.data?.message,
  );

  const certDb = await prisma.certificado.findFirst({
    where: { conclusaoCursoId: sol.data.id },
  });
  record('Prisma: certificado persistido', !!certDb && certDb.numeroCertificado === numCert);

  if (cert.data?.codigoVerificacao) {
    const pub = await api.get(
      `/conclusoes-cursos/verificar-certificado?codigo=${encodeURIComponent(cert.data.codigoVerificacao)}`,
    );
    record(
      'GET /conclusoes-cursos/verificar-certificado (público)',
      pub.status === 200,
      pub.data?.message,
    );
  }

  printSummary();

  const failed = steps.filter((s) => !s.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
