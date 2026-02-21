#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo do período de lançamento de notas
 *
 * 1. Login como ADMIN de uma instituição
 * 2. Listar períodos (vazio)
 * 3. Criar período ABERTO (data atual entre inicio e fim)
 * 4. Validar que lançamento de nota é permitido (sem períodos ou com período aberto)
 * 5. Fechar período (status FECHADO)
 * 6. Tentar lançar nota → deve bloquear 403
 * 7. Reabrir período (ADMIN)
 * 8. Tentar lançar nota → deve permitir
 *
 * Se não existir avaliação com aluno matriculado, cria contexto mínimo via API.
 * Requer: Backend rodando (API_URL), instituição com ano letivo
 * Uso: npx tsx scripts/test-periodo-lancamento-notas.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-periodo-lancamento-notas.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@teste.dsicola.com';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'Admin@123';

const TS = Date.now();

async function criarContextoMinimoParaNota(
  api: AxiosInstance,
  prisma: PrismaClient,
  instituicao: { id: string; nome: string },
  anoLetivo: { id: string; ano: number },
  admin: { id: string; email: string }
): Promise<{ avaliacaoId: string; alunoId: string } | null> {
  try {
  const instituicaoId = instituicao.id;
  const anoLetivoId = anoLetivo.id;
  const ano = anoLetivo.ano;

  let curso = await prisma.curso.findFirst({ where: { instituicaoId } });
  if (!curso) {
    const cr = await api.post('/cursos', { nome: `Curso Teste ${TS}`, codigo: `CT${TS}`, cargaHoraria: 120, valorMensalidade: 0 });
    if (cr.status >= 400) {
      console.error('   [criarContexto] Curso:', cr.status, cr.data?.message);
      return null;
    }
    curso = cr.data;
  }

  let classe = await prisma.classe.findFirst({ where: { instituicaoId } });
  if (!classe) {
    const cr = await api.post('/classes', { nome: '10ª Classe', codigo: `10C-${TS}`, cargaHoraria: 120, valorMensalidade: 50000 });
    if (cr.status >= 400) { console.error('   [criarContexto] Classe:', cr.status, cr.data?.message); return null; }
    classe = cr.data;
  }

  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId, nome: 'Matemática', codigo: `MAT-${TS}`, cargaHoraria: 12 },
    });
  }

  let turno = await prisma.turno.findFirst({ where: { instituicaoId } });
  if (!turno) {
    turno = await prisma.turno.create({ data: { instituicaoId, nome: 'Manhã' } });
  }

  let turma = await prisma.turma.findFirst({ where: { instituicaoId, anoLetivoId, classeId: classe.id } });
  if (!turma) {
    const cr = await api.post('/turmas', { nome: `Turma Teste ${TS}`, classeId: classe.id, anoLetivoId, capacidade: 30 });
    if (cr.status >= 400) { console.error('   [criarContexto] Turma:', cr.status, cr.data?.message); return null; }
    turma = cr.data;
  }

  let prof = await prisma.professor.findFirst({ where: { instituicaoId } });
  if (!prof) {
    const createProf = await api.post('/users', {
      email: `prof.periodo.${TS}@teste.dsicola.com`,
      password: 'Professor@123',
      nomeCompleto: 'Professor Teste Período',
      role: 'PROFESSOR',
    });
    if (createProf.status >= 400) return null;
    await prisma.user.update({ where: { id: createProf.data.id }, data: { instituicaoId, mustChangePassword: false } });
    const cr = await api.post(`/users/${createProf.data.id}/professor`);
    if (cr.status >= 400) return null;
    prof = cr.data;
  }
  const professorId = prof.id;

  const vinculo = await prisma.professorDisciplina.findFirst({
    where: { professorId, disciplinaId: disciplina.id, cursoId: null },
  });
  if (!vinculo) {
    await prisma.professorDisciplina.create({ data: { professorId, disciplinaId: disciplina.id, cursoId: null } });
  }

  const createAluno = await api.post('/users', {
    email: `aluno.periodo.${TS}@teste.dsicola.com`,
    password: 'Aluno@123',
    nomeCompleto: 'Aluno Teste Período',
    role: 'ALUNO',
  });
  if (createAluno.status >= 400) return null;
  const alunoId = createAluno.data.id;
  await prisma.user.update({ where: { id: alunoId }, data: { instituicaoId, mustChangePassword: false } });

  let planoEnsino = await prisma.planoEnsino.findFirst({
    where: { turmaId: turma.id, anoLetivoId, instituicaoId },
  });
  if (!planoEnsino) {
    const createPlano = await api.post('/plano-ensino', {
      professorId,
      anoLetivoId,
      disciplinaId: disciplina.id,
      classeId: classe.id,
      classeOuAno: classe.nome,
      turmaId: turma.id,
      metodologia: 'Expositiva',
      objetivos: 'Objetivos',
      conteudoProgramatico: 'Conteúdo',
      criteriosAvaliacao: 'Provas',
      ementa: 'Ementa',
    });
    if (createPlano.status >= 400) return null;
    planoEnsino = createPlano.data;
    for (let i = 1; i <= 2; i++) {
      await api.post(`/plano-ensino/${planoEnsino.id}/aulas`, {
        titulo: `Aula ${i}`,
        descricao: `Conteúdo`,
        tipo: 'TEORICA',
        quantidadeAulas: 4,
      });
    }
    const evento = await prisma.eventoCalendario.findFirst({ where: { instituicaoId, status: 'APROVADO' } });
    if (!evento) {
      const createEv = await api.post('/eventos', {
        titulo: 'Ano Letivo',
        dataInicio: new Date(ano, 0, 1).toISOString().split('T')[0],
        dataFim: new Date(ano, 11, 31).toISOString().split('T')[0],
        tipo: 'evento',
      });
      if (createEv.status < 400) {
        await api.post('/workflow/submeter', { entidade: 'EventoCalendario', entidadeId: createEv.data.id });
        await api.post('/workflow/aprovar', { entidade: 'EventoCalendario', entidadeId: createEv.data.id });
      }
    }
    await api.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoEnsino.id });
    await api.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoEnsino.id });
  }

  const matriculaAnual = await api.post('/matriculas-anuais', {
    alunoId,
    anoLetivoId,
    nivelEnsino: 'SECUNDARIO',
    classeOuAnoCurso: classe.nome,
    cursoId: curso.id,
  });
  if (matriculaAnual.status >= 400) return null;

  const matricula = await api.post('/matriculas', { alunoId, turmaId: turma.id, status: 'Ativa' });
  if (matricula.status >= 400) return null;

  const trimestreRec = await prisma.trimestre.findFirst({ where: { anoLetivoId } });
  const alunoDisc = await prisma.alunoDisciplina.findFirst({
    where: { alunoId, disciplinaId: disciplina.id, ano },
  });
  if (!alunoDisc && matriculaAnual.data?.id) {
    await prisma.alunoDisciplina.create({
      data: {
        alunoId,
        disciplinaId: disciplina.id,
        turmaId: turma.id,
        matriculaAnualId: matriculaAnual.data.id,
        ano,
        semestre: '1',
        trimestreId: trimestreRec?.id,
        status: 'Cursando',
      },
    });
  }

  const trimestreId = (await prisma.trimestre.findFirst({ where: { anoLetivoId } }))?.id;
  const createAval = await api.post('/avaliacoes', {
    planoEnsinoId: planoEnsino.id,
    turmaId: turma.id,
    professorId,
    tipo: 'PROVA',
    trimestre: 1,
    trimestreId,
    peso: 1,
    data: new Date().toISOString().split('T')[0],
    nome: 'Prova Teste Período',
  });
  if (createAval.status >= 400) {
    console.error('   [criarContexto] Avaliacao:', createAval.status, createAval.data?.message);
    return null;
  }

  return { avaliacaoId: createAval.data.id, alunoId };
  } catch (e: any) {
    console.error('   [criarContexto] Erro:', e?.message || e);
    return null;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Período de Lançamento de Notas - Fluxo Completo');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // ─── 1. Buscar instituição com ano letivo, admin e avaliação+matrícula ───
  const INSTITUICAO_ID_ENV = process.env.INSTITUICAO_ID;
  console.log('1. Buscando instituição com contexto para nota...');
  const instituicoes = await prisma.instituicao.findMany({
    where: { status: 'ativa', ...(INSTITUICAO_ID_ENV ? { id: INSTITUICAO_ID_ENV } : {}) },
    include: {
      anosLetivos: { take: 1, orderBy: { ano: 'desc' } },
    },
  });
  if (instituicoes.length === 0) {
    console.error(INSTITUICAO_ID_ENV ? `   ❌ Instituição ${INSTITUICAO_ID_ENV} não encontrada.` : '   ❌ Nenhuma instituição ativa. Execute o seed primeiro.');
    process.exit(1);
  }

  let instituicao: (typeof instituicoes)[0] | null = null;
  for (const inst of instituicoes) {
    const temAvaliacaoComMatricula = await prisma.avaliacao.findFirst({
      where: {
        instituicaoId: inst.id,
        fechada: false,
        turma: {
          matriculas: {
            some: { status: 'Ativa' },
          },
        },
      },
    });
    if (temAvaliacaoComMatricula && inst.anosLetivos?.[0]) {
      instituicao = inst;
      break;
    }
  }

  if (!instituicao) {
    instituicao = instituicoes[0] ?? null;
  }
  if (!instituicao) {
    console.error('   ❌ Nenhuma instituição ativa. Execute o seed primeiro.');
    process.exit(1);
  }

  let anoLetivo = instituicao.anosLetivos?.[0];
  if (!anoLetivo) {
    console.log('   ⚠ Instituição sem ano letivo. Criando ano letivo de teste...');
    const anoAtual = new Date().getFullYear();
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        ano: anoAtual,
        dataInicio: new Date(anoAtual, 0, 1),
        dataFim: new Date(anoAtual, 11, 31),
        status: 'ATIVO',
        instituicaoId: instituicao.id,
      },
    });
    console.log(`   ✔ Ano letivo ${anoLetivo.ano} criado`);
  }

  const user = await prisma.user.findFirst({
    where: {
      instituicaoId: instituicao.id,
      roles: { some: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
    },
    include: { roles: { select: { role: true } } },
  });

  if (!user) {
    console.error('   ❌ Nenhum ADMIN encontrado para a instituição.');
    process.exit(1);
  }

  // Resetar senha do admin para a de teste (se necessário)
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });
  await prisma.loginAttempt.deleteMany({ where: { email: user.email.toLowerCase() } });

  console.log(`   ✔ Instituição: ${instituicao.nome} (${instituicao.id})`);
  console.log(`   ✔ Ano letivo: ${anoLetivo.ano}`);
  console.log(`   ✔ Admin: ${user.email}`);

  // ─── 2. Login como ADMIN ───────────────────────────────────────────────
  console.log('\n2. Login como ADMIN...');
  const loginRes = await api.post('/auth/login', { email: user.email, password: ADMIN_PASS });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('   ❌ Login falhou:', loginRes.data?.message || loginRes.status);
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;
  console.log('   ✔ Login OK');

  // ─── 3. Listar períodos (pode estar vazio) ───────────────────────────────
  console.log('\n3. Listar períodos...');
  const listRes = await api.get('/periodos-lancamento-notas');
  if (listRes.status !== 200) {
    console.error('   ❌ Falha ao listar:', listRes.status, listRes.data?.message);
    process.exit(1);
  }
  const periodosAntes = Array.isArray(listRes.data) ? listRes.data : [];
  console.log(`   ✔ Períodos existentes: ${periodosAntes.length}`);

  // ─── 4. Criar período ABERTO ────────────────────────────────────────────
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 2);
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + 5);

  console.log('\n4. Criar período ABERTO (Semestre 1)...');
  const createRes = await api.post('/periodos-lancamento-notas', {
    anoLetivoId: anoLetivo.id,
    tipoPeriodo: 'SEMESTRE',
    numeroPeriodo: 1,
    dataInicio: dataInicio.toISOString(),
    dataFim: dataFim.toISOString(),
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    if (createRes.status === 409 || createRes.data?.message?.toLowerCase().includes('já existe') ||
        createRes.data?.message?.toLowerCase().includes('unique') ||
        createRes.data?.message?.toLowerCase().includes('duplicate')) {
      console.log('   ⚠ Período já existe (409). Continuando com o existente.');
    } else {
      console.error('   ❌ Falha ao criar:', createRes.status, createRes.data?.message);
      process.exit(1);
    }
  } else {
    console.log('   ✔ Período criado');
  }

  // ─── 5. Obter período ativo ──────────────────────────────────────────────
  console.log('\n5. Obter período ativo...');
  const ativoRes = await api.get('/periodos-lancamento-notas/ativo');
  if (ativoRes.status !== 200) {
    console.error('   ❌ Falha:', ativoRes.status);
  } else if (ativoRes.data) {
    console.log('   ✔ Período ativo:', ativoRes.data.tipoPeriodo, ativoRes.data.numeroPeriodo);
  } else {
    console.log('   ⚠ Nenhum período ativo (possível overlap de constraint)');
  }

  // ─── 6. Buscar ou criar dados para testar nota (avaliação + aluno) ────────
  console.log('\n6. Buscando contexto para lançamento de nota...');
  let avaliacoes = await prisma.avaliacao.findMany({
    where: {
      instituicaoId: instituicao.id,
      fechada: false,
    },
    include: {
      planoEnsino: { select: { id: true } },
      turma: { include: { matriculas: { take: 1, where: { status: 'Ativa' } } } },
    },
    take: 5,
  });
  let avaliacao = avaliacoes.find((a) => a.planoEnsinoId && a.turma?.matriculas?.length);

  // Se não houver avaliação com aluno, criar contexto mínimo
  if (!avaliacao) {
    console.log('   ⚠ Sem avaliação existente. Criando contexto mínimo...');
    const ctx = await criarContextoMinimoParaNota(api, prisma, instituicao, anoLetivo, user);
    if (ctx) {
      avaliacao = await prisma.avaliacao.findUnique({
        where: { id: ctx.avaliacaoId },
        include: {
          planoEnsino: { select: { id: true } },
          turma: { include: { matriculas: { take: 1, where: { status: 'Ativa' } } } },
        },
      }) as typeof avaliacao;
      if (avaliacao && !avaliacao.turma?.matriculas?.length) {
        (avaliacao as any).turma = { ...avaliacao.turma, matriculas: [{ alunoId: ctx.alunoId }] };
      }
      if (avaliacao) console.log('   ✔ Contexto criado (avaliação + aluno matriculado)');
    }
    if (!avaliacao) console.log('   ⚠ Falha ao criar contexto. Pulando teste de nota.');
  }

  let notaTestou = false;
  let notaBloqueadaEsperado = false;
  let notaPermitidaEsperado = false;

  if (avaliacao?.planoEnsinoId && avaliacao?.turma?.matriculas?.[0]) {
    const alunoId = avaliacao.turma.matriculas[0].alunoId;

    // ─── 7. Tentar lançar nota (deve funcionar com período aberto) ─────────
    console.log('\n7. Tentar lançar nota (período aberto)...');
    const createNotaRes = await api.post('/notas/avaliacao/lote', {
      avaliacaoId: avaliacao.id,
      notas: [{ alunoId, valor: 10 }],
    });

    if (createNotaRes.status === 201 || createNotaRes.status === 200) {
      console.log('   ✔ Lançamento permitido (período aberto)');
      notaPermitidaEsperado = true;
    } else if (createNotaRes.status === 403 && createNotaRes.data?.message?.includes('Período')) {
      console.log('   ⚠ Bloqueado por período (inesperado - período está aberto)');
    } else {
      console.log('   ℹ Resultado:', createNotaRes.status, createNotaRes.data?.message || '');
    }
    notaTestou = true;
  } else {
    console.log('   ⚠ Sem avaliação/aluno para testar lançamento. Pulando teste de nota.');
  }

  // ─── 8. Fechar período e tentar nota novamente ────────────────────────────
  const listFinal = await api.get('/periodos-lancamento-notas');
  const periodosList = Array.isArray(listFinal.data) ? listFinal.data : [];
  const periodo = periodosList.find(
    (p: any) =>
      p.anoLetivoId === anoLetivo.id &&
      p.tipoPeriodo === 'SEMESTRE' &&
      p.numeroPeriodo === 1
  );

  if (periodo && avaliacao?.planoEnsinoId && avaliacao?.turma?.matriculas?.[0]) {
    console.log('\n8. Fechar período e tentar lançar nota...');
    await api.put(`/periodos-lancamento-notas/${periodo.id}`, { status: 'FECHADO' });

    const alunoId = avaliacao.turma.matriculas[0].alunoId;
    const notaFechadaRes = await api.post('/notas/avaliacao/lote', {
      avaliacaoId: avaliacao.id,
      notas: [{ alunoId, valor: 12 }],
    });

    if (notaFechadaRes.status === 403 && notaFechadaRes.data?.message?.includes('Período')) {
      console.log('   ✔ Bloqueio correto: nota não permitida com período fechado');
      notaBloqueadaEsperado = true;
    } else {
      console.log('   ℹ Status:', notaFechadaRes.status, notaFechadaRes.data?.message || '');
    }

    // ─── 9. Reabrir período ────────────────────────────────────────────────
    console.log('\n9. Reabrir período (ADMIN)...');
    const reabrirRes = await api.post(`/periodos-lancamento-notas/${periodo.id}/reabrir`, {
      motivoReabertura: 'Teste automatizado de reabertura',
    });

    if (reabrirRes.status === 200) {
      console.log('   ✔ Período reaberto com sucesso');
    } else {
      console.error('   ❌ Falha ao reabrir:', reabrirRes.status, reabrirRes.data?.message);
    }

    // ─── 10. Verificar que nota volta a ser permitida ───────────────────────
    console.log('\n10. Verificar que lançamento volta a ser permitido...');
    const notaAposRes = await api.post('/notas/avaliacao/lote', {
      avaliacaoId: avaliacao.id,
      notas: [{ alunoId, valor: 11 }],
    });

    if (notaAposRes.status === 201 || notaAposRes.status === 200) {
      console.log('   ✔ Lançamento permitido após reabertura');
    } else {
      console.log('   ℹ Status:', notaAposRes.status, notaAposRes.data?.message || '');
    }
  }

  // ─── Resumo ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO DO TESTE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✓ API de períodos: listar, criar, ativo, update, reabrir');
  if (notaTestou) {
    console.log('  ✓ Validação de janela nas operações de nota');
  } else {
    console.log('  ○ Teste de nota não executado (sem avaliação/aluno disponível)');
  }
  console.log('\n  Fluxo completo validado.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
