#!/usr/bin/env npx tsx
/**
 * TESTE: Matrícula de estudante em turma e em disciplina
 *
 * Valida o fluxo completo:
 * 1. Matrícula em turma (POST /matriculas)
 * 2. Matrícula em disciplina (POST /aluno-disciplinas)
 *
 * Funciona para Ensino Secundário ou Superior.
 *
 * Pré-requisitos:
 * - Backend rodando em http://localhost:3001
 * - Dados de seed (npx tsx scripts/seed-multi-tenant-test.ts) ou instituição com dados cadastrados
 *
 * Uso: npx tsx scripts/test-matricula-turma-disciplina.ts
 */
import axios, { AxiosInstance } from 'axios';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

const ano = process.env.ANO_TESTE ? parseInt(process.env.ANO_TESTE, 10) : new Date().getFullYear();

function log(ok: boolean, msg: string, detalhe?: string) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${msg}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Matrícula em Turma e em Disciplina');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL} | Ano: ${ano}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  // ─── 1. Login SUPER_ADMIN ─────────────────────────────────────────────────────
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou:', loginSuper.data?.message || 'Sem token');
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;
  log(true, 'Login SUPER_ADMIN');

  // ─── 2. Buscar instituição com dados ────────────────────────────────────────
  let inst = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });
  if (!inst) {
    inst = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
  }
  if (!inst) {
    inst = await prisma.instituicao.findFirst({
      select: { id: true, nome: true, tipoAcademico: true },
    });
  }

  if (!inst) {
    console.error('❌ Nenhuma instituição encontrada. Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const isSecundario = inst.tipoAcademico === 'SECUNDARIO';
  const tipoLabel = isSecundario ? 'Secundário' : 'Superior';
  log(true, `Instituição: ${inst.nome} (${tipoLabel})`);

  // Login como admin da instituição
  let adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId: inst.id,
      roles: { some: { role: 'ADMIN' } },
    },
    select: { id: true, email: true },
  });

  if (!adminUser) {
    adminUser = await prisma.user.findFirst({
      where: { roles: { some: { role: 'SUPER_ADMIN' } } },
      select: { id: true, email: true },
    });
  }

  let token: string;
  if (adminUser?.email) {
    const loginInst = await api.post('/auth/login', {
      email: adminUser.email,
      password: SENHA,
    });
    if (loginInst.status === 200 && loginInst.data?.accessToken) {
      token = loginInst.data.accessToken;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      log(true, `Login admin: ${adminUser.email}`);
    } else {
      const loginSuper2 = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
      token = loginSuper2.data.accessToken;
      log(true, 'Continuando com SUPER_ADMIN (admin da inst não encontrado ou senha diferente)');
    }
  } else {
    token = loginSuper.data.accessToken;
    log(true, 'Usando SUPER_ADMIN');
  }

  // ─── 3. Dados para matrícula ─────────────────────────────────────────────────
  const anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: inst.id, ano },
  });
  if (!anoLetivo) {
    console.error(`❌ Ano letivo ${ano} não encontrado para a instituição. Crie um ano letivo ativo.`);
    process.exit(1);
  }
  log(true, `Ano letivo: ${ano} (${anoLetivo.id})`);

  const aluno = await prisma.user.findFirst({
    where: {
      instituicaoId: inst.id,
      roles: { some: { role: 'ALUNO' } },
    },
    select: { id: true, nomeCompleto: true, email: true },
  });
  if (!aluno) {
    console.error('❌ Nenhum aluno encontrado na instituição.');
    process.exit(1);
  }
  log(true, `Aluno: ${aluno.nomeCompleto} (${aluno.id})`);

  const turma = await prisma.turma.findFirst({
    where: { instituicaoId: inst.id, anoLetivoId: anoLetivo.id },
    include: {
      curso: { select: { id: true, nome: true } },
      classe: { select: { id: true, nome: true } },
    },
  });
  if (!turma) {
    console.error('❌ Nenhuma turma encontrada. Crie uma turma no ano letivo.');
    process.exit(1);
  }
  log(true, `Turma: ${turma.nome} (curso: ${turma.curso?.nome || '-'}, classe: ${turma.classe?.nome || '-'})`);

  // Disciplina vinculada ao curso da turma
  let disciplinaId: string;
  if (turma.cursoId) {
    const cd = await prisma.cursoDisciplina.findFirst({
      where: { cursoId: turma.cursoId },
      include: { disciplina: { select: { id: true, nome: true } } },
    });
    if (!cd) {
      console.error('❌ Nenhuma disciplina vinculada ao curso da turma. Vincule disciplinas ao curso.');
      process.exit(1);
    }
    disciplinaId = cd.disciplinaId;
    log(true, `Disciplina: ${cd.disciplina.nome} (${disciplinaId})`);
  } else {
    // Secundário: disciplina via PlanoEnsino (usa raw query para evitar coluna pauta_status)
    const row = await prisma.$queryRaw<{ disciplina_id: string; disciplina_nome: string }[]>`
      SELECT pe.disciplina_id as disciplina_id, d.nome as disciplina_nome
      FROM plano_ensino pe
      JOIN disciplinas d ON d.id = pe.disciplina_id
      WHERE pe.instituicao_id = ${inst.id} AND pe.ano_letivo_id = ${anoLetivo.id}
        AND pe.turma_id = ${turma.id} AND pe.estado = 'APROVADO'
      LIMIT 1
    `;
    if (!row || row.length === 0) {
      console.error('❌ Nenhum plano de ensino aprovado para a turma.');
      process.exit(1);
    }
    disciplinaId = row[0].disciplina_id;
    log(true, `Disciplina: ${row[0].disciplina_nome} (${disciplinaId})`);
  }

  // ─── 4. Matrícula anual (se não existir) ──────────────────────────────────────
  let matriculaAnual = await prisma.matriculaAnual.findFirst({
    where: {
      alunoId: aluno.id,
      anoLetivoId: anoLetivo.id,
      instituicaoId: inst.id,
      status: 'ATIVA',
    },
  });

  if (!matriculaAnual) {
    const payload: any = {
      alunoId: aluno.id,
      anoLetivoId: anoLetivo.id,
      nivelEnsino: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
      classeOuAnoCurso: turma.classe?.nome || turma.curso?.nome || `Ano ${ano}`,
    };
    if (turma.cursoId) payload.cursoId = turma.cursoId;
    if (turma.classeId) payload.classeId = turma.classeId;

    const resMatAnual = await api.post('/matriculas-anuais', payload);
    if (resMatAnual.status >= 400) {
      log(false, 'Matrícula anual', resMatAnual.data?.message || JSON.stringify(resMatAnual.data));
      process.exit(1);
    }
    matriculaAnual = resMatAnual.data;
    log(true, 'Matrícula anual criada');
  } else {
    log(true, 'Matrícula anual já existe');
  }

  // ─── 5. Matrícula em turma ────────────────────────────────────────────────────
  let matriculaTurma = await prisma.matricula.findFirst({
    where: {
      alunoId: aluno.id,
      turmaId: turma.id,
      status: 'Ativa',
    },
  });

  if (!matriculaTurma) {
    const resMat = await api.post('/matriculas', {
      alunoId: aluno.id,
      turmaId: turma.id,
      status: 'Ativa',
    });
    if (resMat.status >= 400) {
      log(false, 'Matrícula em turma', resMat.data?.message || JSON.stringify(resMat.data));
      process.exit(1);
    }
    matriculaTurma = resMat.data;
    log(true, 'Matrícula em turma criada');
  } else {
    log(true, 'Matrícula em turma já existe');
  }

  // ─── 6. Plano de ensino (necessário para matrícula em disciplina) ───────────────
  let planoEnsino = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM plano_ensino
    WHERE instituicao_id = ${inst.id} AND ano_letivo_id = ${anoLetivo.id}
      AND turma_id = ${turma.id} AND disciplina_id = ${disciplinaId}
      AND estado = 'APROVADO' AND (bloqueado = false OR bloqueado IS NULL)
    LIMIT 1
  `.then((r) => (r && r.length > 0 ? { id: r[0].id } : null));

  if (!planoEnsino) {
    const professor = await prisma.professor.findFirst({
      where: { instituicaoId: inst.id },
      select: { id: true },
    });
    if (!professor) {
      console.error('❌ Nenhum professor cadastrado. Cadastre um professor.');
      process.exit(1);
    }

    const createPlano = await api.post('/plano-ensino', {
      professorId: professor.id,
      anoLetivoId: anoLetivo.id,
      disciplinaId,
      turmaId: turma.id,
      cursoId: turma.cursoId || undefined,
      classeId: turma.classeId || undefined,
      classeOuAno: turma.classe?.nome || turma.curso?.nome || '',
      metodologia: 'Teste',
      objetivos: 'Objetivos',
      conteudoProgramatico: 'Conteúdo',
      criteriosAvaliacao: 'Provas',
      ementa: 'Ementa',
    });

    if (createPlano.status >= 400) {
      log(false, 'Criar plano de ensino', createPlano.data?.message);
      process.exit(1);
    }
    planoEnsino = createPlano.data;

    const subRes = await api.post('/workflow/submeter', {
      entidade: 'PlanoEnsino',
      entidadeId: planoEnsino.id,
    });
    if (subRes.status >= 400) {
      log(false, 'Submeter plano', subRes.data?.message);
    }

    const aprRes = await api.post('/workflow/aprovar', {
      entidade: 'PlanoEnsino',
      entidadeId: planoEnsino.id,
    });
    if (aprRes.status >= 400) {
      log(false, 'Aprovar plano', aprRes.data?.message);
    }
    log(true, 'Plano de ensino criado e aprovado');
  } else {
    log(true, 'Plano de ensino já existe');
  }

  // ─── 7. Matrícula em disciplina ──────────────────────────────────────────────
  const semestreOuTrimestre = isSecundario ? '1' : '1';
  const trimestre = await prisma.trimestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, numero: 1 },
  });
  const semestre = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, numero: 1 },
  });

  const existingAlunoDisc = await prisma.alunoDisciplina.findFirst({
    where: {
      alunoId: aluno.id,
      disciplinaId,
      ano,
      semestre: semestreOuTrimestre,
    },
  });

  if (existingAlunoDisc) {
    log(true, 'Matrícula em disciplina já existe');
  } else {
    const payload: any = {
      alunoId: aluno.id,
      disciplinaId,
      turmaId: turma.id,
      ano,
      semestre: semestreOuTrimestre,
      status: 'Matriculado',
    };
    if (trimestre) payload.trimestreId = trimestre.id;
    if (semestre) payload.semestreId = semestre.id;

    const resAlunoDisc = await api.post('/aluno-disciplinas', payload);
    if (resAlunoDisc.status >= 400) {
      log(false, 'Matrícula em disciplina', resAlunoDisc.data?.message || JSON.stringify(resAlunoDisc.data));
      process.exit(1);
    }
    log(true, 'Matrícula em disciplina criada');
  }

  // ─── 8. Verificação final ───────────────────────────────────────────────────
  const matriculaCount = await prisma.matricula.count({
    where: { alunoId: aluno.id },
  });
  const alunoDiscCount = await prisma.alunoDisciplina.count({
    where: { alunoId: aluno.id, ano },
  });

  console.log('\n  ─── Resumo ───────────────────────────────────────────────────────────');
  log(true, `Matrículas em turma do aluno: ${matriculaCount}`);
  log(true, `Matrículas em disciplinas do aluno (ano ${ano}): ${alunoDiscCount}`);
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE CONCLUÍDO - Matrícula em turma e disciplina OK');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
