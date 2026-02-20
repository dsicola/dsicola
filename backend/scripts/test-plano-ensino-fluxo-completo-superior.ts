#!/usr/bin/env npx tsx
/**
 * TESTE FLUXO COMPLETO PLANO DE ENSINO - Ensino Superior
 *
 * Garante:
 * 1. Fluxo completo: contexto → criar plano → aulas → bibliografia → atualizar → stats
 * 2. Multi-tenancy 100%: isolamento entre instituições
 * 3. Respeito ao tipo: SUPERIOR usa cursoId/semestre, rejeita classe/classeOuAno
 *
 * Requer: Backend rodando em http://localhost:3001
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 *
 * Uso: npx tsx scripts/test-plano-ensino-fluxo-completo-superior.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

const TEST_PROF_EMAIL = `prof.plano.sup.${Date.now()}@teste.dsicola.com`;
const TEST_PROF_PASS = 'Professor@123';

interface Result { name: string; ok: boolean; message?: string }

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO PLANO DE ENSINO - Ensino Superior (Multi-tenant)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const results: Result[] = [];

  // ─── 1. Instituição Superior ─────────────────────────────────────────────────────────
  let inst = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });
  if (!inst) {
    inst = await prisma.instituicao.findFirst({
      where: { tipoAcademico: 'SUPERIOR' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
  }
  if (!inst) {
    console.error('❌ Nenhuma instituição superior. Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  if (inst.tipoAcademico !== 'SUPERIOR') {
    await prisma.instituicao.update({
      where: { id: inst.id },
      data: { tipoAcademico: 'SUPERIOR' },
    });
    inst.tipoAcademico = 'SUPERIOR';
  }

  console.log(`1. Instituição: ${inst.nome} (${inst.id}) tipoAcademico=${inst.tipoAcademico}\n`);

  const instSecundario = await prisma.instituicao.findFirst({
    where: { tipoAcademico: 'SECUNDARIO' },
    select: { id: true },
  });
  const countSecAntes = instSecundario
    ? await prisma.planoEnsino.count({ where: { instituicaoId: instSecundario.id } })
    : 0;

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
    console.error('❌ Login falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  // ─── 3. Admin da instituição superior ───────────────────────────────────────────────
  let admin = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    const cr = await api.post('/users', {
      email: `admin.plano.sup.${Date.now()}@teste.dsicola.com`,
      password: SUPER_ADMIN_PASS,
      nomeCompleto: 'Admin Plano Superior',
      role: 'ADMIN',
      instituicaoId: inst.id,
    });
    if (cr.status >= 400) {
      console.error('❌ Criar ADMIN:', cr.data?.message);
      process.exit(1);
    }
    admin = cr.data;
    await prisma.user.update({
      where: { id: admin.id },
      data: { mustChangePassword: false },
    });
  } else {
    const hash = await bcrypt.hash(SUPER_ADMIN_PASS, 10);
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hash, mustChangePassword: false },
    });
  }

  await prisma.loginAttempt.deleteMany({ where: { email: admin.email.toLowerCase() } });
  const loginAdmin = await api.post('/auth/login', { email: admin.email, password: SUPER_ADMIN_PASS });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    console.error('❌ Login ADMIN falhou:', loginAdmin.data?.message || loginAdmin.status);
    process.exit(1);
  }
  const tipoAcad = loginAdmin.data.user?.tipoAcademico;
  if (tipoAcad !== 'SUPERIOR') {
    console.error('❌ JWT deve ter tipoAcademico=SUPERIOR');
    process.exit(1);
  }

  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAdmin.data.accessToken}` },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 4. Professor ────────────────────────────────────────────────────────────────────
  const createProf = await adminApi.post('/users', {
    email: TEST_PROF_EMAIL,
    password: TEST_PROF_PASS,
    nomeCompleto: 'Professor Plano Superior',
    role: 'PROFESSOR',
  });
  if (createProf.status >= 400) {
    console.error('❌ Criar professor:', createProf.data?.message);
    process.exit(1);
  }
  const novoUser = createProf.data;
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

  // ─── 5. Ano letivo, Semestre, Curso, Disciplina, Turma ─────────────────────────────────
  const ano = new Date().getFullYear();
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: inst.id, ano },
    select: { id: true, ano: true },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        instituicaoId: inst.id,
        ano,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: admin.id,
      },
    }) as any;
  }

  let semestre = await prisma.semestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, instituicaoId: inst.id, numero: 1 },
    select: { id: true, numero: true },
  });
  if (!semestre) {
    semestre = await prisma.semestre.create({
      data: {
        anoLetivoId: anoLetivo.id,
        anoLetivo: ano,
        numero: 1,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 5, 30),
        status: 'ATIVO',
        instituicaoId: inst.id,
      },
      select: { id: true, numero: true },
    }) as any;
  }

  let curso = await prisma.curso.findFirst({
    where: { instituicaoId: inst.id },
    select: { id: true, nome: true },
  });
  if (!curso) {
    const crCurso = await adminApi.post('/cursos', {
      nome: 'Licenciatura em Matemática',
      codigo: 'LIC-MAT',
      cargaHoraria: 240,
      valorMensalidade: 75000,
    });
    if (crCurso.status >= 400) {
      console.error('❌ Criar curso:', crCurso.data?.message);
      process.exit(1);
    }
    curso = crCurso.data;
  }

  const codigoDisc = `CAL-TEST-${Date.now()}`;
  let disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId: inst.id, codigo: codigoDisc },
    select: { id: true, nome: true },
  });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: {
        instituicaoId: inst.id,
        nome: `Cálculo I Teste ${Date.now()}`,
        codigo: codigoDisc,
        cargaHoraria: 60,
        cursoId: curso.id,
      },
      select: { id: true, nome: true },
    });
  }
  await prisma.cursoDisciplina.upsert({
    where: { cursoId_disciplinaId: { cursoId: curso.id, disciplinaId: disciplina.id } },
    create: { cursoId: curso.id, disciplinaId: disciplina.id, semestre: 1 },
    update: {},
  });

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: inst.id, anoLetivoId: anoLetivo.id, cursoId: curso.id },
    select: { id: true, nome: true },
  });
  if (!turma) {
    const crTurma = await adminApi.post('/turmas', {
      nome: '1º Ano S1',
      cursoId: curso.id,
      anoLetivoId: anoLetivo.id,
      semestre: 1,
      capacidade: 40,
    });
    if (crTurma.status >= 400) {
      console.error('❌ Criar turma:', crTurma.data?.message);
      process.exit(1);
    }
    turma = crTurma.data;
  }

  // ─── 6. TIPO INSTITUIÇÃO: SUPERIOR rejeita classe ─────────────────────────────────────
  console.log('6. TIPO INSTITUIÇÃO: SUPERIOR rejeita classe...');
  const rejClasse = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    cursoId: curso.id,
    semestre: 1,
    classeId: 'uuid-fake',
    classeOuAno: '10ª Classe',
  });
  results.push({
    name: 'SUPERIOR rejeita classe/classeOuAno',
    ok: rejClasse.status === 400 && (rejClasse.data?.message || '').toLowerCase().includes('classe'),
    message: rejClasse.status !== 400 ? rejClasse.data?.message : undefined,
  });

  // ─── 7. GET contexto (deve retornar cursos, semestres) ────────────────────────────────
  console.log('7. GET /plano-ensino/contexto...');
  const ctx = await adminApi.get('/plano-ensino/contexto');
  results.push({
    name: 'GET contexto retorna 200',
    ok: ctx.status === 200,
    message: ctx.status !== 200 ? ctx.data?.message : undefined,
  });
  if (ctx.status === 200) {
    const temCursos = Array.isArray(ctx.data?.cursos) && ctx.data.cursos.length > 0;
    const temSemestres = Array.isArray(ctx.data?.semestres) && ctx.data.semestres.length > 0;
    results.push({
      name: 'Contexto SUPERIOR: cursos presente',
      ok: temCursos,
      message: temCursos ? undefined : 'Cursos vazio ou ausente',
    });
    results.push({
      name: 'Contexto SUPERIOR: semestres presente',
      ok: temSemestres,
      message: temSemestres ? undefined : 'Semestres vazio ou ausente',
    });
  }

  // ─── 8. Criar plano de ensino (curso + semestre) ───────────────────────────────────────
  console.log('8. POST /plano-ensino (cursoId + semestre)...');
  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    cursoId: curso.id,
    semestre: 1,
    semestreId: semestre.id,
    turmaId: turma.id,
    metodologia: 'Aulas expositivas',
    objetivos: 'Objetivos de teste',
    conteudoProgramatico: 'Conteúdo de teste',
    criteriosAvaliacao: 'Provas e trabalhos',
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

  const planoDb = await prisma.planoEnsino.findFirst({
    where: { id: planoId, instituicaoId: inst.id },
    select: { cursoId: true, semestre: true, classeId: true, instituicaoId: true },
  });
  results.push({
    name: 'Plano no banco: instituicaoId correto',
    ok: planoDb?.instituicaoId === inst.id,
  });
  results.push({
    name: 'Plano SUPERIOR: cursoId + semestre',
    ok: !!planoDb?.cursoId && planoDb?.semestre != null,
  });
  results.push({
    name: 'Plano SUPERIOR: sem classeId',
    ok: planoDb?.classeId == null,
  });

  // ─── 9. Aula planejada ───────────────────────────────────────────────────────────────
  console.log('9. POST aula planejada...');
  const createAula = await adminApi.post(`/plano-ensino/${planoId}/aulas`, {
    titulo: 'Introdução aos Limites',
    descricao: 'Conceitos iniciais',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  results.push({
    name: 'Criar aula planejada',
    ok: createAula.status >= 200 && createAula.status < 300,
    message: createAula.status >= 400 ? createAula.data?.message : undefined,
  });

  // ─── 10. Bibliografia ────────────────────────────────────────────────────────────────
  console.log('10. POST bibliografia...');
  const createBib = await adminApi.post(`/plano-ensino/${planoId}/bibliografias`, {
    titulo: 'Cálculo Diferencial e Integral',
    autor: 'Autor Teste',
    editora: 'Editora Teste',
    ano: 2024,
    tipo: 'BIBLIOGRAFIA_BASICA',
  });
  results.push({
    name: 'Criar bibliografia',
    ok: createBib.status >= 200 && createBib.status < 300,
    message: createBib.status >= 400 ? createBib.data?.message : undefined,
  });

  // ─── 11. Stats e carga-horaria ───────────────────────────────────────────────────────
  console.log('11. GET stats e carga-horaria...');
  const stats = await adminApi.get(`/plano-ensino/${planoId}/stats`);
  const carga = await adminApi.get(`/plano-ensino/${planoId}/carga-horaria`);
  results.push({ name: 'GET stats', ok: stats.status === 200 });
  results.push({ name: 'GET carga-horaria', ok: carga.status === 200 });

  // ─── 12. Atualizar plano ──────────────────────────────────────────────────────────────
  console.log('12. PUT plano (metodologia)...');
  const updatePlano = await adminApi.put(`/plano-ensino/${planoId}`, {
    metodologia: 'Metodologia atualizada',
  });
  results.push({
    name: 'Atualizar plano',
    ok: updatePlano.status === 200,
    message: updatePlano.status >= 400 ? updatePlano.data?.message : undefined,
  });

  // ─── 13. Isolamento: Secundário inalterado ────────────────────────────────────────────
  const countSecDepois = instSecundario
    ? await prisma.planoEnsino.count({ where: { instituicaoId: instSecundario.id } })
    : 0;
  results.push({
    name: 'Isolamento: Secundário inalterado',
    ok: countSecDepois === countSecAntes,
    message: countSecDepois !== countSecAntes ? `Sec: ${countSecAntes} -> ${countSecDepois}` : undefined,
  });

  // ─── 14. GET plano (listar) ───────────────────────────────────────────────────────────
  const list = await adminApi.get('/plano-ensino', { params: { anoLetivoId: anoLetivo.id } });
  results.push({
    name: 'GET plano-ensino (listar)',
    ok: list.status === 200 && Array.isArray(list.data) && list.data.some((p: any) => p.id === planoId),
  });

  await prisma.$disconnect();

  printResults(results);
  const falhas = results.filter((r) => !r.ok);
  if (falhas.length > 0) {
    process.exit(1);
  }
  console.log('\n✅ TESTE PASSOU: Fluxo completo Plano de Ensino Superior 100% multi-tenant e respeitando tipo de instituição.\n');
}

function printResults(results: Result[]) {
  console.log('\n--- RESULTADOS ---');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.message ? `: ${r.message}` : ''}`);
  }
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
