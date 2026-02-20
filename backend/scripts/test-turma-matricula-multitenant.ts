#!/usr/bin/env npx tsx
/**
 * TESTE: Criar Turma + Fluxo Completo de Matrícula - Multi-Tenant
 *
 * Valida 100%:
 * - Cria turma via API (Secundário e Superior)
 * - Fluxo completo: matrícula anual → matrícula em turma → matrícula em disciplina
 * - Isolamento multi-tenant (Admin A não vê dados da Inst B e vice-versa)
 *
 * Pré-requisitos:
 * - npx tsx scripts/seed-multi-tenant-test.ts
 * - Backend rodando em http://localhost:3001
 *
 * Uso: npx tsx scripts/test-turma-matricula-multitenant.ts
 */
import axios, { AxiosInstance } from 'axios';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
const ANO = process.env.ANO_TESTE ? parseInt(process.env.ANO_TESTE, 10) : new Date().getFullYear();
const TS = Date.now();

interface Check {
  tipo: 'SEC' | 'SUP' | 'MT';
  step: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function log(tipo: 'SEC' | 'SUP' | 'MT', step: string, ok: boolean, detail?: string) {
  checks.push({ tipo, step, ok, detail });
  const icon = ok ? '✅' : '❌';
  const prefix = tipo === 'SEC' ? '[SEC]' : tipo === 'SUP' ? '[SUP]' : '[MT]';
  console.log(`  ${icon} ${prefix} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function runFluxoSecundario(adminApi: AxiosInstance, instId: string): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true },
  });
  if (!admin) {
    log('SEC', 'Admin encontrado', false, 'Admin não encontrado');
    return false;
  }

  const aluno = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true, nomeCompleto: true },
  });
  if (!aluno) {
    log('SEC', 'Aluno encontrado', false);
    return false;
  }

  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instId, ano: ANO },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instId,
        ano: ANO,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: admin.id,
      },
    });
  }

  for (const num of [1, 2, 3]) {
    const tri = await prisma.trimestre.findFirst({
      where: { anoLetivoId: anoLetivo.id, numero: num },
    });
    if (!tri) {
      await prisma.trimestre.create({
        data: {
          anoLetivoId: anoLetivo.id,
          anoLetivo: ANO,
          numero: num,
          dataInicio: new Date(ANO, (num - 1) * 4, 1),
          dataFim: new Date(ANO, num * 4 - 1, 28),
          status: num === 1 ? 'ATIVO' : 'PLANEJADO',
          instituicaoId: instId,
        },
      });
    }
  }

  let classe = await prisma.classe.findFirst({ where: { instituicaoId: instId } });
  if (!classe) {
    const cr = await adminApi.post('/classes', {
      nome: '10ª Classe',
      codigo: `10C-${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 50000,
    });
    if (cr.status >= 400) {
      log('SEC', 'Criar classe', false, cr.data?.message);
      return false;
    }
    classe = cr.data;
  }

  let curso = await prisma.curso.findFirst({ where: { instituicaoId: instId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Curso Área ${TS}`,
      codigo: `CA${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 50000,
    });
    if (cr.status >= 400) {
      log('SEC', 'Criar curso', false, cr.data?.message);
      return false;
    }
    curso = cr.data;
  }

  const turmaRes = await adminApi.post('/turmas', {
    nome: `Turma 10A Teste ${TS}`,
    classeId: classe.id,
    cursoId: curso.id,
    anoLetivoId: anoLetivo.id,
    capacidade: 30,
  });
  if (turmaRes.status >= 400) {
    log('SEC', 'Criar turma', false, turmaRes.data?.message);
    return false;
  }
  const turma = turmaRes.data;
  log('SEC', 'Criar turma', true, turma.nome);

  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId: instId, nome: 'Matemática', codigo: `MAT-${TS}`, cargaHoraria: 4 },
    });
  }
  await prisma.cursoDisciplina.upsert({
    where: { cursoId_disciplinaId: { cursoId: curso.id, disciplinaId: disciplina.id } },
    update: {},
    create: { cursoId: curso.id, disciplinaId: disciplina.id, semestre: 1 },
  });

  await prisma.matriculaAnual.updateMany({
    where: { alunoId: aluno.id, instituicaoId: instId, anoLetivoId: { not: anoLetivo.id } },
    data: { status: 'CANCELADA' },
  });

  let matAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId: aluno.id, anoLetivoId: anoLetivo.id, instituicaoId: instId, status: 'ATIVA' },
  });
  if (!matAnual) {
    const matAnualRes = await adminApi.post('/matriculas-anuais', {
      alunoId: aluno.id,
      anoLetivoId: anoLetivo.id,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: classe.nome,
      cursoId: curso.id,
      classeId: classe.id,
    });
    if (matAnualRes.status >= 400) {
      log('SEC', 'Matrícula anual', false, matAnualRes.data?.message);
      return false;
    }
    matAnual = matAnualRes.data;
  }
  log('SEC', 'Matrícula anual', true);

  const matTurmaRes = await adminApi.post('/matriculas', {
    alunoId: aluno.id,
    turmaId: turma.id,
    status: 'Ativa',
  });
  if (matTurmaRes.status >= 400) {
    log('SEC', 'Matrícula em turma', false, matTurmaRes.data?.message);
    return false;
  }
  log('SEC', 'Matrícula em turma', true);

  const disciplinaId = disciplina.id;

  const professor = await prisma.professor.findFirst({ where: { instituicaoId: instId } });
  if (!professor) {
    log('SEC', 'Plano ensino (professor)', false, 'Professor não encontrado');
    return true;
  }

  const planoExiste = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM plano_ensino
    WHERE instituicao_id = ${instId} AND ano_letivo_id = ${anoLetivo.id}
      AND turma_id = ${turma.id} AND disciplina_id = ${disciplinaId}
      AND estado = 'APROVADO' AND (bloqueado = false OR bloqueado IS NULL)
    LIMIT 1
  `.then((r) => r && r.length > 0);

  if (!planoExiste) {
    const createPlano = await adminApi.post('/plano-ensino', {
      professorId: professor.id,
      anoLetivoId: anoLetivo.id,
      disciplinaId,
      classeId: classe.id,
      turmaId: turma.id,
      classeOuAno: classe.nome,
      metodologia: 'Teste',
      objetivos: 'Objetivos',
      conteudoProgramatico: 'Conteúdo',
      criteriosAvaliacao: 'Provas',
      ementa: 'Ementa',
    });
    if (createPlano.status >= 400) {
      log('SEC', 'Plano de ensino', false, createPlano.data?.message);
    } else {
      await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: createPlano.data.id });
      await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: createPlano.data.id });
      log('SEC', 'Plano de ensino', true);
    }
  }

  const trim1 = await prisma.trimestre.findFirst({ where: { anoLetivoId: anoLetivo.id, numero: 1 } });
  const alunoDiscRes = await adminApi.post('/aluno-disciplinas', {
    alunoId: aluno.id,
    disciplinaId,
    turmaId: turma.id,
    ano: ANO,
    semestre: '1',
    status: 'Matriculado',
    trimestreId: trim1?.id,
  });
  if (alunoDiscRes.status >= 400 && alunoDiscRes.status !== 409) {
    log('SEC', 'Matrícula em disciplina', false, alunoDiscRes.data?.message);
  } else {
    log('SEC', 'Matrícula em disciplina', true);
  }

  return !checks.some((c) => c.tipo === 'SEC' && !c.ok);
}

async function runFluxoSuperior(adminApi: AxiosInstance, instId: string): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true },
  });
  if (!admin) {
    log('SUP', 'Admin encontrado', false);
    return false;
  }

  const aluno = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true, nomeCompleto: true },
  });
  if (!aluno) {
    log('SUP', 'Aluno encontrado', false);
    return false;
  }

  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instId, ano: ANO },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        instituicaoId: instId,
        ano: ANO,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: admin.id,
      },
    });
  }

  let sem1 = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, numero: 1 },
  });
  if (!sem1) {
    sem1 = await prisma.semestre.create({
      data: {
        anoLetivoId: anoLetivo.id,
        anoLetivo: ANO,
        numero: 1,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 5, 30),
        status: 'ATIVO',
        instituicaoId: instId,
      },
    });
  }

  let curso = await prisma.curso.findFirst({ where: { instituicaoId: instId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Licenciatura Teste ${TS}`,
      codigo: `LIC${TS}`,
      cargaHoraria: 240,
      valorMensalidade: 75000,
    });
    if (cr.status >= 400) {
      log('SUP', 'Criar curso', false, cr.data?.message);
      return false;
    }
    curso = cr.data;
  }

  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instId } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId: instId, nome: 'Cálculo I', codigo: `CAL-${TS}`, cargaHoraria: 4 },
    });
  }

  await prisma.cursoDisciplina.upsert({
    where: { cursoId_disciplinaId: { cursoId: curso.id, disciplinaId: disciplina.id } },
    update: {},
    create: { cursoId: curso.id, disciplinaId: disciplina.id, semestre: 1 },
  });

  const professor = await prisma.professor.findFirst({ where: { instituicaoId: instId } });
  if (professor) {
    await prisma.professorDisciplina.upsert({
      where: {
        professorId_disciplinaId_cursoId: {
          professorId: professor.id,
          disciplinaId: disciplina.id,
          cursoId: curso.id,
        },
      },
      update: {},
      create: { professorId: professor.id, disciplinaId: disciplina.id, cursoId: curso.id },
    });
  }

  const turmaRes = await adminApi.post('/turmas', {
    nome: `Turma 1º Ano S1 Teste ${TS}`,
    cursoId: curso.id,
    anoLetivoId: anoLetivo.id,
    semestre: 1,
    capacidade: 40,
  });
  if (turmaRes.status >= 400) {
    log('SUP', 'Criar turma', false, turmaRes.data?.message);
    return false;
  }
  const turma = turmaRes.data;
  log('SUP', 'Criar turma', true, turma.nome);

  await prisma.matriculaAnual.updateMany({
    where: { alunoId: aluno.id, instituicaoId: instId, anoLetivoId: { not: anoLetivo.id } },
    data: { status: 'CANCELADA' },
  });

  let matAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId: aluno.id, anoLetivoId: anoLetivo.id, instituicaoId: instId, status: 'ATIVA' },
  });
  if (!matAnual) {
    const matAnualRes = await adminApi.post('/matriculas-anuais', {
      alunoId: aluno.id,
      anoLetivoId: anoLetivo.id,
      nivelEnsino: 'SUPERIOR',
      classeOuAnoCurso: '1º Ano',
      cursoId: curso.id,
    });
    if (matAnualRes.status >= 400) {
      log('SUP', 'Matrícula anual', false, matAnualRes.data?.message);
      return false;
    }
    matAnual = matAnualRes.data;
  }
  log('SUP', 'Matrícula anual', true);

  const matTurmaRes = await adminApi.post('/matriculas', {
    alunoId: aluno.id,
    turmaId: turma.id,
    status: 'Ativa',
  });
  if (matTurmaRes.status >= 400) {
    log('SUP', 'Matrícula em turma', false, matTurmaRes.data?.message);
    return false;
  }
  log('SUP', 'Matrícula em turma', true);

  const planoExiste = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM plano_ensino
    WHERE instituicao_id = ${instId} AND ano_letivo_id = ${anoLetivo.id}
      AND turma_id = ${turma.id} AND disciplina_id = ${disciplina.id}
      AND estado = 'APROVADO' AND (bloqueado = false OR bloqueado IS NULL)
    LIMIT 1
  `.then((r) => r && r.length > 0);

  if (!planoExiste && professor) {
    const createPlano = await adminApi.post('/plano-ensino', {
      professorId: professor.id,
      anoLetivoId: anoLetivo.id,
      disciplinaId: disciplina.id,
      cursoId: curso.id,
      turmaId: turma.id,
      semestre: 1,
      semestreId: sem1.id,
      metodologia: 'Teste',
      objetivos: 'Objetivos',
      conteudoProgramatico: 'Conteúdo',
      criteriosAvaliacao: 'Provas',
      ementa: 'Ementa',
    });
    if (createPlano.status < 400) {
      await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: createPlano.data.id });
      await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: createPlano.data.id });
      log('SUP', 'Plano de ensino', true);
    }
  }

  const alunoDiscRes = await adminApi.post('/aluno-disciplinas', {
    alunoId: aluno.id,
    disciplinaId: disciplina.id,
    turmaId: turma.id,
    ano: ANO,
    semestre: '1',
    status: 'Matriculado',
    semestreId: sem1.id,
  });
  if (alunoDiscRes.status >= 400 && alunoDiscRes.status !== 409) {
    log('SUP', 'Matrícula em disciplina', false, alunoDiscRes.data?.message);
  } else {
    log('SUP', 'Matrícula em disciplina', true);
  }

  return !checks.some((c) => c.tipo === 'SUP' && !c.ok);
}

async function verificarMultiTenant(adminApiA: AxiosInstance, adminApiB: AxiosInstance, instAId: string, instBId: string): Promise<boolean> {
  const matriculasA = await adminApiA.get('/matriculas');
  const matriculasB = await adminApiB.get('/matriculas');

  if (matriculasA.status >= 400) {
    log('MT', 'Admin A lista matrículas', false, matriculasA.data?.message);
    return false;
  }
  if (matriculasB.status >= 400) {
    log('MT', 'Admin B lista matrículas', false, matriculasB.data?.message);
    return false;
  }

  const listaA = Array.isArray(matriculasA.data) ? matriculasA.data : matriculasA.data?.data || [];
  const listaB = Array.isArray(matriculasB.data) ? matriculasB.data : matriculasB.data?.data || [];

  const alunosA = await prisma.user.findMany({
    where: { instituicaoId: instAId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true },
  });
  const alunosB = await prisma.user.findMany({
    where: { instituicaoId: instBId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true },
  });
  const idsAlunosA = new Set(alunosA.map((a) => a.id));
  const idsAlunosB = new Set(alunosB.map((a) => a.id));

  const listaAContemB = listaA.some((m: any) => {
    const aid = m.alunoId ?? m.aluno_id ?? m.aluno?.id;
    return aid && idsAlunosB.has(aid);
  });
  const listaBContemA = listaB.some((m: any) => {
    const aid = m.alunoId ?? m.aluno_id ?? m.aluno?.id;
    return aid && idsAlunosA.has(aid);
  });

  if (listaAContemB) {
    log('MT', 'Isolamento: Admin A não vê matrículas B', false, 'Admin A viu dados da Inst B');
    return false;
  }
  if (listaBContemA) {
    log('MT', 'Isolamento: Admin B não vê matrículas A', false, 'Admin B viu dados da Inst A');
    return false;
  }

  log('MT', 'Isolamento multi-tenant', true, 'Admin A só vê A, Admin B só vê B');
  return true;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Turma + Matrícula Completa - Multi-Tenant (Secundário e Superior)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL} | Ano: ${ANO} | Timestamp: ${TS}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true, nome: true },
  });
  const instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    select: { id: true, nome: true },
  });

  if (!instA || !instB) {
    console.error('❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (plano) {
    const umAno = new Date();
    umAno.setFullYear(umAno.getFullYear() + 1);
    for (const inst of [instA, instB]) {
      const assinatura = await prisma.assinatura.findFirst({ where: { instituicaoId: inst.id } });
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
    headers: { Authorization: `Bearer ${loginA.data.accessToken}`, 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

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
    headers: { Authorization: `Bearer ${loginB.data.accessToken}`, 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  console.log('═══ FLUXO SECUNDÁRIO (Inst A) ═══\n');
  const okSec = await runFluxoSecundario(adminApiA, instA.id);

  console.log('\n═══ FLUXO SUPERIOR (Inst B) ═══\n');
  const okSup = await runFluxoSuperior(adminApiB, instB.id);

  console.log('\n═══ VERIFICAÇÃO MULTI-TENANT ═══\n');
  const okMT = await verificarMultiTenant(adminApiA, adminApiB, instA.id, instB.id);

  await prisma.$disconnect();

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  const secFail = checks.filter((c) => c.tipo === 'SEC' && !c.ok);
  const supFail = checks.filter((c) => c.tipo === 'SUP' && !c.ok);
  const mtFail = checks.filter((c) => c.tipo === 'MT' && !c.ok);

  if (secFail.length) {
    console.log('\n❌ Secundário:');
    secFail.forEach((c) => console.log(`   - ${c.step}: ${c.detail || 'falhou'}`));
  }
  if (supFail.length) {
    console.log('\n❌ Superior:');
    supFail.forEach((c) => console.log(`   - ${c.step}: ${c.detail || 'falhou'}`));
  }
  if (mtFail.length) {
    console.log('\n❌ Multi-tenant:');
    mtFail.forEach((c) => console.log(`   - ${c.step}: ${c.detail || 'falhou'}`));
  }

  const allOk = okSec && okSup && okMT;
  if (!allOk) {
    console.log('\n⚠️  TESTE FALHOU\n');
    process.exit(1);
  }
  console.log('\n✅ TESTE 100% OK: Turma + Matrícula + Multi-tenant validados.\n');
}

main().catch((e) => {
  console.error('❌ Erro:', e?.message || e);
  process.exit(1);
});
