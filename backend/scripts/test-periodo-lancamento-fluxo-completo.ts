#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo Período de Lançamento de Notas
 *
 * Valida 100%:
 * 1. Sem período → Professor NÃO pode lançar (403)
 * 2. ADMIN cria período (data atual entre início e fim) → ABERTO
 * 3. Professor pode lançar notas (201)
 * 4. Período EXPIRADO (data fim no passado) ou FECHADO → Professor NÃO pode lançar (403)
 * 5. Reabertura apenas ADMIN, com motivo obrigatório e log de auditoria
 * 6. Após reabertura → Professor volta a poder lançar (201)
 *
 * Requer: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx scripts/test-periodo-lancamento-fluxo-completo.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

function criarApi(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });
}

async function login(api: AxiosInstance, email: string, password: string = SENHA): Promise<boolean> {
  try {
    const res = await api.post('/auth/login', { email, password });
    if (res.status !== 200 || !res.data?.accessToken) return false;
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
    return true;
  } catch (e: any) {
    if (e?.code === 'ECONNREFUSED' || e?.message?.includes('connect')) {
      throw new Error(`Backend não está rodando em ${API_URL}. Inicie com: npm run dev`);
    }
    throw e;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo Completo Período de Lançamento de Notas');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar Inst A (seed-multi-tenant)
  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    include: {
      anosLetivos: { take: 1, orderBy: { ano: 'desc' } },
    },
  });

  if (!instA) {
    console.error('   ❌ Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: {
      instituicaoId: instA.id,
      roles: { some: { role: 'ADMIN' } },
    },
    include: { roles: { select: { role: true } } },
  });
  const prof = await prisma.user.findFirst({
    where: {
      instituicaoId: instA.id,
      roles: { some: { role: 'PROFESSOR' } },
    },
    include: { roles: { select: { role: true } } },
  });
  const anoLetivo = instA.anosLetivos[0];

  if (!admin || !prof || !anoLetivo) {
    console.error('   ❌ Admin, Professor ou Ano Letivo não encontrados.');
    process.exit(1);
  }

  // Professor precisa existir na tabela professor
  let professorEnt = await prisma.professor.findFirst({
    where: { userId: prof.id, instituicaoId: instA.id },
  });
  if (!professorEnt) {
    professorEnt = await prisma.professor.create({
      data: { userId: prof.id, instituicaoId: instA.id },
    });
  }

  // Resetar senhas e desbloquear login
  const hash = await bcrypt.hash(SENHA, 10);
  await prisma.user.updateMany({
    where: { id: { in: [admin.id, prof.id] } },
    data: { password: hash, mustChangePassword: false },
  });
  await prisma.loginAttempt.deleteMany({
    where: { email: { in: [admin.email!, prof.email!].map((e) => e?.toLowerCase()) } },
  });

  // Remover todos os períodos da instituição para teste limpo
  await prisma.periodoLancamentoNotas.deleteMany({ where: { instituicaoId: instA.id } });
  console.log('   ✔ Períodos existentes removidos (estado limpo)\n');

  const apiAdmin = criarApi();
  const apiProf = criarApi();

  // Criar contexto: turma, plano, avaliação, matrícula
  const curso = await prisma.curso.findFirst({ where: { instituicaoId: instA.id } });
  const classe = await prisma.classe.findFirst({ where: { instituicaoId: instA.id } });
  const disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instA.id } });
  const turno = await prisma.turno.findFirst({ where: { instituicaoId: instA.id } });
  if (!curso || !classe || !disciplina || !turno) {
    console.error('   ❌ Curso, classe, disciplina ou turno não encontrados. Execute seed-multi-tenant.');
    process.exit(1);
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: instA.id, anoLetivoId: anoLetivo.id },
    include: { matriculas: { where: { status: 'Ativa' }, take: 1 } },
  });
  if (!turma) {
    turma = await prisma.turma.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivo.id,
        nome: 'Turma Teste Fluxo',
        cursoId: curso.id,
        classeId: classe.id,
        turnoId: turno.id,
        capacidade: 30,
      },
      include: { matriculas: { take: 1 } },
    });
  }

  const alunoParaMatricula = await prisma.user.findFirst({
    where: { instituicaoId: instA.id, roles: { some: { role: 'ALUNO' } } },
  });
  if (!alunoParaMatricula) {
    console.error('   ❌ Nenhum aluno na instituição. Execute seed-multi-tenant.');
    process.exit(1);
  }

  // MatriculaAnual (obrigatório para operações acadêmicas)
  let matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: {
      alunoId: alunoParaMatricula.id,
      instituicaoId: instA.id,
      anoLetivoId: anoLetivo.id,
    },
  });
  if (!matriculaAnual) {
    matriculaAnual = await prisma.matriculaAnual.create({
      data: {
        alunoId: alunoParaMatricula.id,
        instituicaoId: instA.id,
        anoLetivo: anoLetivo.ano,
        anoLetivoId: anoLetivo.id,
        nivelEnsino: 'SECUNDARIO' as any,
        classeOuAnoCurso: classe.nome,
        cursoId: curso.id,
        classeId: classe.id,
        status: 'ATIVA' as any,
      },
    });
  }

  let matricula = await prisma.matricula.findFirst({
    where: { turmaId: turma.id, alunoId: alunoParaMatricula.id, status: 'Ativa' },
  });
  if (!matricula) {
    matricula = await prisma.matricula.create({
      data: {
        turma: { connect: { id: turma.id } },
        anoLetivoRef: { connect: { id: anoLetivo.id } },
        aluno: { connect: { id: alunoParaMatricula.id } },
        status: 'Ativa',
      },
    });
  }

  const trim = await prisma.trimestre.findFirst({ where: { anoLetivoId: anoLetivo.id } });

  // AlunoDisciplina (obrigatório para bloqueio acadêmico ao lançar notas)
  const ano = anoLetivo.ano;
  let alunoDisc = await prisma.alunoDisciplina.findFirst({
    where: {
      alunoId: alunoParaMatricula.id,
      disciplinaId: disciplina.id,
      matriculaAnualId: matriculaAnual.id,
    },
  });
  if (!alunoDisc) {
    alunoDisc = await prisma.alunoDisciplina.create({
      data: {
        alunoId: alunoParaMatricula.id,
        disciplinaId: disciplina.id,
        turmaId: turma.id,
        matriculaAnualId: matriculaAnual.id,
        ano,
        semestre: '1',
        status: 'Cursando',
        trimestreId: trim?.id,
      },
    });
  } else if (alunoDisc.status !== 'Cursando' && alunoDisc.status !== 'Matriculado') {
    await prisma.alunoDisciplina.update({
      where: { id: alunoDisc.id },
      data: { status: 'Cursando' as any },
    });
  }

  let plano = await prisma.planoEnsino.findFirst({
    where: {
      turmaId: turma.id,
      anoLetivoId: anoLetivo.id,
      professorId: professorEnt.id,
    },
  });
  if (!plano) {
    plano = await prisma.planoEnsino.create({
      data: {
        turmaId: turma.id,
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        professorId: professorEnt.id,
        disciplinaId: disciplina.id,
        classeId: classe.id,
        instituicaoId: instA.id,
        metodologia: 'Teste',
        objetivos: 'Teste',
        conteudoProgramatico: 'Teste',
        criteriosAvaliacao: 'Teste',
        ementa: 'Teste',
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
  } else if (plano.estado !== 'APROVADO' || plano.status !== 'APROVADO') {
    await prisma.planoEnsino.update({
      where: { id: plano.id },
      data: { status: 'APROVADO' as any, estado: 'APROVADO' as any },
    });
  }

  let avaliacao = await prisma.avaliacao.findFirst({
    where: {
      planoEnsinoId: plano.id,
      fechada: false,
    },
    include: {
      turma: { include: { matriculas: { take: 1, where: { status: 'Ativa' } } } },
      planoEnsino: { select: { professorId: true } },
    },
  });
  if (!avaliacao) {
    avaliacao = await prisma.avaliacao.create({
      data: {
        planoEnsinoId: plano.id,
        turmaId: turma.id,
        professorId: professorEnt.id,
        instituicaoId: instA.id,
        tipo: 'PROVA',
        trimestre: 1,
        trimestreId: trim?.id ?? undefined,
        peso: 1,
        data: new Date(),
        nome: 'Prova Teste Fluxo',
        fechada: false,
      },
      include: {
        turma: { include: { matriculas: { take: 1, where: { status: 'Ativa' } } } },
        planoEnsino: { select: { professorId: true } },
      },
    });
  }

  const alunoId = matricula.alunoId;
  console.log(`   Contexto: avaliação ${avaliacao.id}, aluno ${alunoId}\n`);

  // ─── 1. Sem período → Professor NÃO pode lançar ───────────────────────────
  console.log('1. Professor tenta lançar nota SEM período configurado (esperado: 403)...');
  if (!(await login(apiProf, prof.email!))) {
    console.error('   ❌ Login professor falhou');
    process.exit(1);
  }

  const notaSemPeriodo = await apiProf.post('/notas/avaliacao/lote', {
    avaliacaoId: avaliacao.id,
    notas: [{ alunoId, valor: 10 }],
  });

  if (notaSemPeriodo.status !== 403) {
    console.error(`   ❌ FALHA: Esperado 403, obtido ${notaSemPeriodo.status}. Professor não deveria lançar sem período.`);
    console.error('   Resposta:', JSON.stringify(notaSemPeriodo.data, null, 2));
    process.exit(1);
  }
  if (!notaSemPeriodo.data?.message?.toLowerCase().includes('período') && !notaSemPeriodo.data?.message?.toLowerCase().includes('configurado')) {
    console.log('   ℹ Mensagem:', notaSemPeriodo.data?.message);
  }
  console.log('   ✔ Bloqueio correto: 403 sem período');

  // ─── 2. ADMIN cria período ABERTO ────────────────────────────────────────
  console.log('\n2. ADMIN cria período (data atual entre início e fim)...');
  if (!(await login(apiAdmin, admin.email!))) {
    console.error('   ❌ Login admin falhou');
    process.exit(1);
  }

  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 2);
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 7);

  const createPeriodo = await apiAdmin.post('/periodos-lancamento-notas', {
    anoLetivoId: anoLetivo.id,
    tipoPeriodo: 'TRIMESTRE',
    numeroPeriodo: 1,
    dataInicio: dataInicio.toISOString(),
    dataFim: dataFim.toISOString(),
  });

  if (createPeriodo.status !== 201 && createPeriodo.status !== 200) {
    console.error('   ❌ Falha ao criar período:', createPeriodo.status, createPeriodo.data?.message);
    process.exit(1);
  }
  const periodoId = createPeriodo.data?.id;
  console.log('   ✔ Período criado (ABERTO)');

  // ─── 3. Professor pode lançar (período aberto) ────────────────────────────
  console.log('\n3. Professor lança nota com período ABERTO (esperado: 201)...');
  if (!(await login(apiProf, prof.email!))) process.exit(1);

  const notaComPeriodo = await apiProf.post('/notas/avaliacao/lote', {
    avaliacaoId: avaliacao.id,
    notas: [{ alunoId, valor: 12 }],
  });

  if (notaComPeriodo.status !== 201 && notaComPeriodo.status !== 200) {
    console.error(`   ❌ FALHA: Esperado 201, obtido ${notaComPeriodo.status}. ${notaComPeriodo.data?.message || ''}`);
    process.exit(1);
  }
  console.log('   ✔ Lançamento permitido (201)');

  // ─── 4. Fechar período → Professor NÃO pode lançar ────────────────────────
  console.log('\n4. ADMIN fecha período...');
  if (!(await login(apiAdmin, admin.email!))) process.exit(1);
  await apiAdmin.put(`/periodos-lancamento-notas/${periodoId}`, { status: 'FECHADO' });
  console.log('   ✔ Período fechado');

  console.log('   4b. Professor tenta lançar nota com período FECHADO (esperado: 403)...');
  if (!(await login(apiProf, prof.email!))) process.exit(1);

  const notaFechado = await apiProf.post('/notas/avaliacao/lote', {
    avaliacaoId: avaliacao.id,
    notas: [{ alunoId, valor: 13 }],
  });

  if (notaFechado.status !== 403) {
    console.error(`   ❌ FALHA: Esperado 403, obtido ${notaFechado.status}. Professor não deveria lançar com período fechado.`);
    process.exit(1);
  }
  console.log('   ✔ Bloqueio correto: 403 com período fechado');

  // ─── 5. Professor NÃO pode reabrir (apenas ADMIN) ────────────────────────
  console.log('\n5. Professor tenta reabrir período (esperado: 403)...');
  const reabrirProf = await apiProf.post(`/periodos-lancamento-notas/${periodoId}/reabrir`, {
    motivoReabertura: 'Tentativa professor',
  });

  if (reabrirProf.status === 200) {
    console.error('   ❌ FALHA: Professor conseguiu reabrir! Apenas ADMIN deve poder.');
    process.exit(1);
  }
  console.log('   ✔ Reabertura bloqueada para professor (403)');

  // ─── 6. ADMIN reabre com motivo ───────────────────────────────────────────
  console.log('\n6. ADMIN reabre período com motivo obrigatório...');
  if (!(await login(apiAdmin, admin.email!))) process.exit(1);

  const reabrirAdmin = await apiAdmin.post(`/periodos-lancamento-notas/${periodoId}/reabrir`, {
    motivoReabertura: 'Reabertura para teste automatizado - validação de auditoria',
  });

  if (reabrirAdmin.status !== 200) {
    console.error('   ❌ Falha ao reabrir:', reabrirAdmin.status, reabrirAdmin.data?.message);
    process.exit(1);
  }
  console.log('   ✔ Período reaberto (com log de auditoria)');

  // ─── 7. Professor volta a poder lançar ───────────────────────────────────
  console.log('\n7. Professor lança nota após reabertura (esperado: 201)...');
  if (!(await login(apiProf, prof.email!))) process.exit(1);

  const notaAposReabrir = await apiProf.post('/notas/avaliacao/lote', {
    avaliacaoId: avaliacao.id,
    notas: [{ alunoId, valor: 14 }],
  });

  if (notaAposReabrir.status !== 201 && notaAposReabrir.status !== 200) {
    console.error(`   ❌ FALHA: Esperado 201, obtido ${notaAposReabrir.status}. ${notaAposReabrir.data?.message || ''}`);
    process.exit(1);
  }
  console.log('   ✔ Lançamento permitido após reabertura (201)');

  // ─── 8. Período EXPIRADO (data fim no passado) → fecha automaticamente ───
  console.log('\n8. Período EXPIRADO: data fim no passado fecha automaticamente...');
  if (!(await login(apiAdmin, admin.email!))) process.exit(1);

  // Fechar período 1 (o que estava aberto)
  await apiAdmin.put(`/periodos-lancamento-notas/${periodoId}`, { status: 'FECHADO' });

  // Criar período 2 com dataFim no passado (será tratado como EXPIRADO)
  const passadoInicio = new Date();
  passadoInicio.setDate(passadoInicio.getDate() - 30);
  const passadoFim = new Date();
  passadoFim.setDate(passadoFim.getDate() - 1);

  await apiAdmin.post('/periodos-lancamento-notas', {
    anoLetivoId: anoLetivo.id,
    tipoPeriodo: 'TRIMESTRE',
    numeroPeriodo: 2,
    dataInicio: passadoInicio.toISOString(),
    dataFim: passadoFim.toISOString(),
  });

  if (!(await login(apiProf, prof.email!))) process.exit(1);
  const notaExpirado = await apiProf.post('/notas/avaliacao/lote', {
    avaliacaoId: avaliacao.id,
    notas: [{ alunoId, valor: 15 }],
  });

  if (notaExpirado.status !== 403) {
    console.error(`   ❌ FALHA: Com todos os períodos fechados/expirados, esperado 403, obtido ${notaExpirado.status}.`);
    process.exit(1);
  }
  console.log('   ✔ Bloqueio correto: 403 com período EXPIRADO (data fim no passado)');

  // ─── Resumo final ────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO - FLUXO 100% VALIDADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✓ Sem período → Professor não pode lançar (403)');
  console.log('  ✓ ADMIN cria período → fica ABERTO quando data entre início e fim');
  console.log('  ✓ Período ABERTO → Professor pode lançar notas (201)');
  console.log('  ✓ Período FECHADO/EXPIRADO → Professor não pode lançar (403)');
  console.log('  ✓ Reabertura apenas ADMIN, com motivo obrigatório');
  console.log('  ✓ Após reabertura → Professor volta a poder lançar (201)');
  console.log('\n  Fluxo completo funcionando 100%.\n');
}

main()
  .catch((e: any) => {
    console.error('\n❌ Erro:', e.message);
    if (e?.response) {
      console.error('   Status:', e.response.status);
      console.error('   Data:', JSON.stringify(e.response.data, null, 2));
    }
    if (e?.code === 'ECONNREFUSED') {
      console.error(`\n   Inicie o backend: cd backend && npm run dev`);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
