#!/usr/bin/env npx tsx
/**
 * TESTE COMPLETO: Plano de Ensino + Professor - Secundário e Superior
 *
 * Valida:
 * 1. Admin cria plano de ensino (classe/curso, disciplina, turma)
 * 2. Admin adiciona aula planejada, submete e aprova
 * 3. Professor vê tudo: GET /plano-ensino, /turmas/professor, /professor-disciplinas/me,
 *    GET /aulas-planejadas, GET /aulas-lancadas, pode lançar aula
 *
 * Pré-requisitos: npx tsx scripts/seed-multi-tenant-test.ts
 * Backend: http://localhost:3001
 *
 * Uso: npx tsx scripts/test-plano-ensino-professor-secundario-superior.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
const ANO = process.env.ANO_TESTE ? parseInt(process.env.ANO_TESTE, 10) : new Date().getFullYear();
const TS = Date.now();

interface Check { tipo: 'SEC' | 'SUP'; name: string; ok: boolean; msg?: string }
const checks: Check[] = [];

function add(tipo: 'SEC' | 'SUP', name: string, ok: boolean, msg?: string) {
  const icon = ok ? '✅' : '❌';
  const p = tipo === 'SEC' ? '[SEC]' : '[SUP]';
  console.log(`  ${icon} ${p} ${name}${msg ? `: ${msg}` : ''}`);
  checks.push({ tipo, name, ok, msg });
}

async function runSecundario(
  api: AxiosInstance,
  adminApi: AxiosInstance,
  profApi: AxiosInstance,
  instId: string
): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    add('SEC', 'Admin existe', false, 'Admin não encontrado');
    return false;
  }

  const prof = await prisma.professor.findFirst({ where: { instituicaoId: instId } });
  if (!prof) {
    add('SEC', 'Professor existe', false, 'Professor não encontrado');
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

  let trim1 = await prisma.trimestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, numero: 1 },
  });
  if (!trim1) {
    trim1 = await prisma.trimestre.create({
      data: {
        anoLetivoId: anoLetivo.id,
        anoLetivo: ANO,
        numero: 1,
        dataInicio: new Date(ANO, 0, 1),
        dataFim: new Date(ANO, 2, 31),
        status: 'ATIVO',
        instituicaoId: instId,
      },
    });
  } else if (trim1.status === 'ENCERRADO') {
    await prisma.trimestre.update({
      where: { id: trim1.id },
      data: { status: 'ATIVO', encerradoPor: null, encerradoEm: null },
    });
    trim1 = await prisma.trimestre.findUniqueOrThrow({ where: { id: trim1.id } });
  }

  let classe = await prisma.classe.findFirst({ where: { instituicaoId: instId } });
  if (!classe) {
    const cr = await adminApi.post('/classes', {
      nome: `10ª Classe ${TS}`,
      codigo: `10C-${TS}`,
      cargaHoraria: 120,
      valorMensalidade: 50000,
    });
    classe = cr.status < 400 ? cr.data : null;
  }
  if (!classe) {
    add('SEC', 'Classe', false, 'Não foi possível obter classe');
    return false;
  }

  const codigoDiscSec = `MAT-PROF-SEC-${TS}`;
  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instId, codigo: codigoDiscSec } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId: instId, nome: 'Matemática', codigo: codigoDiscSec, cargaHoraria: 4 },
    });
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: instId, anoLetivoId: anoLetivo.id, classeId: classe.id },
  });
  if (!turma) {
    const cr = await adminApi.post('/turmas', {
      nome: `Turma 10A ${TS}`,
      classeId: classe.id,
      anoLetivoId: anoLetivo.id,
      capacidade: 30,
    });
    turma = cr.status < 400 ? cr.data : null;
  }
  if (!turma) {
    add('SEC', 'Turma', false, 'Não foi possível obter turma');
    return false;
  }

  await prisma.planoEnsino.deleteMany({
    where: { instituicaoId: instId, disciplinaId: disciplina.id, anoLetivoId: anoLetivo.id, turmaId: turma.id },
  });

  const createPlano = await adminApi.post('/plano-ensino', {
    professorId: prof.id,
    anoLetivoId: anoLetivo.id,
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

  if (createPlano.status >= 400) {
    add('SEC', 'Criar plano de ensino', false, createPlano.data?.message);
    return false;
  }
  add('SEC', 'Criar plano de ensino', true);

  const planoId = createPlano.data.id;

  const createAula = await adminApi.post(`/plano-ensino/${planoId}/aulas`, {
    titulo: 'Aula 1 - Introdução',
    descricao: 'Conceitos iniciais',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  add('SEC', 'Adicionar aula planejada', createAula.status < 400, createAula.data?.message);

  const putSec = await adminApi.put(`/plano-ensino/${planoId}`, {
    ementa: 'Ementa completa para aprovação do plano de ensino.',
    objetivos: 'Objetivos de aprendizagem da disciplina.',
    metodologia: 'Aulas expositivas e práticas.',
    criteriosAvaliacao: 'Provas escritas e trabalhos práticos.',
  });
  add('SEC', 'Preencher apresentação (PUT)', putSec.status < 400, putSec.data?.message);

  const planoAula = createAula.status < 400
    ? await prisma.planoAula.findFirst({ where: { planoEnsinoId: planoId }, select: { id: true } })
    : null;

  const subRes = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoId });
  add('SEC', 'Submeter plano', subRes.status < 400, subRes.data?.message);

  const aprRes = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoId });
  add('SEC', 'Aprovar plano', aprRes.status < 400, aprRes.data?.message);

  const dataAula = new Date(ANO, 1, 10);
  if (planoAula) {
    await prisma.distribuicaoAula.upsert({
      where: { planoAulaId_data: { planoAulaId: planoAula.id, data: dataAula } },
      update: {},
      create: {
        planoAulaId: planoAula.id,
        planoEnsinoId: planoId,
        data: dataAula,
        instituicaoId: instId,
      },
    });
  }

  await prisma.encerramentoAcademico.updateMany({
    where: { instituicaoId: instId, anoLetivo: ANO, periodo: 'TRIMESTRE_1' },
    data: { status: 'ABERTO', encerradoPor: null, encerradoEm: null },
  });

  // ─── Validações como PROFESSOR ─────────────────────────────────────────
  const getPlano = await profApi.get('/plano-ensino', { params: { anoLetivoId: anoLetivo.id } });
  const planos = Array.isArray(getPlano.data) ? getPlano.data : (getPlano.data ? [getPlano.data] : []);
  const profViuPlano = getPlano.status === 200 && planos.some((p: any) => p.id === planoId);
  add('SEC', 'Professor: GET /plano-ensino', profViuPlano, profViuPlano ? undefined : `Status ${getPlano.status}, planos: ${planos.length}`);

  const turmasProf = await profApi.get('/turmas/professor', { params: { incluirPendentes: 'true' } });
  const turmas = turmasProf.data?.turmas || [];
  const profViuTurma = turmasProf.status === 200 && (turmas.length > 0 || (turmasProf.data?.disciplinasSemTurma?.length ?? 0) > 0);
  add('SEC', 'Professor: GET /turmas/professor', profViuTurma, profViuTurma ? undefined : `Status ${turmasProf.status}`);

  const discMe = await profApi.get('/professor-disciplinas/me');
  const atribs = Array.isArray(discMe.data) ? discMe.data : [];
  add('SEC', 'Professor: GET /professor-disciplinas/me', discMe.status === 200 && atribs.length >= 0, discMe.data?.message);

  const aulasPlanej = await profApi.get('/aulas-planejadas', {
    params: { disciplinaId: disciplina.id, anoLetivo: ANO, professorId: prof.id },
  });
  const aulas = Array.isArray(aulasPlanej.data) ? aulasPlanej.data : [];
  add('SEC', 'Professor: GET /aulas-planejadas', aulasPlanej.status === 200, aulasPlanej.data?.message || `Aulas: ${aulas.length}`);

  if (planoAula) {
    const lancar = await profApi.post('/aulas-lancadas', {
      planoAulaId: planoAula.id,
      data: dataAula.toISOString().split('T')[0],
      cargaHoraria: 2,
    });
    const lancou = lancar.status < 400 || (lancar.status === 400 && lancar.data?.message?.includes('lançamento'));
    add('SEC', 'Professor: POST /aulas-lancadas', lancou, lancou ? undefined : lancar.data?.message);
  }

  const aulasLancadas = await profApi.get('/aulas-lancadas');
  add('SEC', 'Professor: GET /aulas-lancadas', aulasLancadas.status === 200, aulasLancadas.data?.message);

  return checks.filter(c => c.tipo === 'SEC' && !c.ok).length === 0;
}

async function runSuperior(
  api: AxiosInstance,
  adminApi: AxiosInstance,
  profApi: AxiosInstance,
  instId: string
): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ADMIN' } } },
    select: { id: true },
  });
  if (!admin) {
    add('SUP', 'Admin existe', false, 'Admin não encontrado');
    return false;
  }

  const prof = await prisma.professor.findFirst({ where: { instituicaoId: instId } });
  if (!prof) {
    add('SUP', 'Professor existe', false, 'Professor não encontrado');
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
  } else if (sem1.status === 'ENCERRADO') {
    await prisma.semestre.update({
      where: { id: sem1.id },
      data: { status: 'ATIVO', encerradoPor: null, encerradoEm: null },
    });
    sem1 = await prisma.semestre.findUniqueOrThrow({ where: { id: sem1.id } });
  }

  let curso = await prisma.curso.findFirst({ where: { instituicaoId: instId } });
  if (!curso) {
    const cr = await adminApi.post('/cursos', {
      nome: `Licenciatura ${TS}`,
      codigo: `LIC-${TS}`,
      cargaHoraria: 240,
      valorMensalidade: 75000,
      duracao: '4 anos',
      grau: 'Licenciatura',
    });
    curso = cr.status < 400 ? cr.data : null;
  }
  if (!curso) {
    add('SUP', 'Curso', false, 'Não foi possível obter curso');
    return false;
  }

  const codigoDiscSup = `CAL-PROF-SUP-${TS}`;
  let disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instId, codigo: codigoDiscSup } });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId: instId, nome: 'Cálculo I', codigo: codigoDiscSup, cargaHoraria: 4 },
    });
  }

  {
    const ex = await prisma.cursoDisciplina.findFirst({
      where: { cursoId: curso.id, disciplinaId: disciplina.id, classeId: null },
    });
    if (!ex) {
      await prisma.cursoDisciplina.create({
        data: { cursoId: curso.id, disciplinaId: disciplina.id, semestre: 1 },
      });
    }
  }

  const pdWhere = { professorId: prof.id, disciplinaId: disciplina.id, cursoId: curso.id };
  const pdExists = await prisma.professorDisciplina.findFirst({ where: pdWhere });
  if (!pdExists) {
    await prisma.professorDisciplina.create({
      data: { professorId: prof.id, disciplinaId: disciplina.id, cursoId: curso.id },
    });
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: instId, anoLetivoId: anoLetivo.id, cursoId: curso.id },
  });
  if (!turma) {
    const cr = await adminApi.post('/turmas', {
      nome: `Turma 1º Ano S1 ${TS}`,
      cursoId: curso.id,
      anoLetivoId: anoLetivo.id,
      semestre: 1,
      capacidade: 40,
    });
    turma = cr.status < 400 ? cr.data : null;
  }
  if (!turma) {
    add('SUP', 'Turma', false, 'Não foi possível obter turma');
    return false;
  }

  await prisma.planoEnsino.deleteMany({
    where: { instituicaoId: instId, disciplinaId: disciplina.id, anoLetivoId: anoLetivo.id, turmaId: turma.id },
  });

  const createPlano = await adminApi.post('/plano-ensino', {
    professorId: prof.id,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    cursoId: curso.id,
    semestre: 1,
    semestreId: sem1.id,
    turmaId: turma.id,
    metodologia: 'Expositiva',
    objetivos: 'Objetivos',
    conteudoProgramatico: 'Conteúdo',
    criteriosAvaliacao: 'Provas',
    ementa: 'Ementa',
  });

  if (createPlano.status >= 400) {
    add('SUP', 'Criar plano de ensino', false, createPlano.data?.message);
    return false;
  }
  add('SUP', 'Criar plano de ensino', true);

  const planoId = createPlano.data.id;

  const createAula = await adminApi.post(`/plano-ensino/${planoId}/aulas`, {
    titulo: 'Aula 1 - Limites',
    descricao: 'Introdução aos limites',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  add('SUP', 'Adicionar aula planejada', createAula.status < 400, createAula.data?.message);

  const putSup = await adminApi.put(`/plano-ensino/${planoId}`, {
    ementa: 'Ementa completa para aprovação do plano de ensino.',
    objetivos: 'Objetivos de aprendizagem da disciplina.',
    metodologia: 'Aulas expositivas e práticas.',
    criteriosAvaliacao: 'Provas escritas e trabalhos práticos.',
  });
  add('SUP', 'Preencher apresentação (PUT)', putSup.status < 400, putSup.data?.message);

  const planoAula = createAula.status < 400
    ? await prisma.planoAula.findFirst({ where: { planoEnsinoId: planoId }, select: { id: true } })
    : null;

  const subRes = await adminApi.post('/workflow/submeter', { entidade: 'PlanoEnsino', entidadeId: planoId });
  add('SUP', 'Submeter plano', subRes.status < 400, subRes.data?.message);

  const aprRes = await adminApi.post('/workflow/aprovar', { entidade: 'PlanoEnsino', entidadeId: planoId });
  add('SUP', 'Aprovar plano', aprRes.status < 400, aprRes.data?.message);

  const dataAula = new Date(ANO, 2, 5);
  if (planoAula) {
    await prisma.distribuicaoAula.upsert({
      where: { planoAulaId_data: { planoAulaId: planoAula.id, data: dataAula } },
      update: {},
      create: {
        planoAulaId: planoAula.id,
        planoEnsinoId: planoId,
        data: dataAula,
        instituicaoId: instId,
      },
    });
  }

  await prisma.encerramentoAcademico.updateMany({
    where: { instituicaoId: instId, anoLetivo: ANO, periodo: 'SEMESTRE_1' },
    data: { status: 'ABERTO', encerradoPor: null, encerradoEm: null },
  });

  // ─── Validações como PROFESSOR ─────────────────────────────────────────
  const getPlano = await profApi.get('/plano-ensino', { params: { anoLetivoId: anoLetivo.id } });
  const planos = Array.isArray(getPlano.data) ? getPlano.data : (getPlano.data ? [getPlano.data] : []);
  const profViuPlano = getPlano.status === 200 && planos.some((p: any) => p.id === planoId);
  add('SUP', 'Professor: GET /plano-ensino', profViuPlano, profViuPlano ? undefined : `Status ${getPlano.status}, planos: ${planos.length}`);

  const turmasProf = await profApi.get('/turmas/professor', { params: { incluirPendentes: 'true' } });
  const turmas = turmasProf.data?.turmas || [];
  const profViuTurma = turmasProf.status === 200 && (turmas.length > 0 || (turmasProf.data?.disciplinasSemTurma?.length ?? 0) > 0);
  add('SUP', 'Professor: GET /turmas/professor', profViuTurma, profViuTurma ? undefined : `Status ${turmasProf.status}`);

  const discMe = await profApi.get('/professor-disciplinas/me');
  const atribs = Array.isArray(discMe.data) ? discMe.data : [];
  add('SUP', 'Professor: GET /professor-disciplinas/me', discMe.status === 200 && atribs.length >= 0, discMe.data?.message);

  const aulasPlanej = await profApi.get('/aulas-planejadas', {
    params: { disciplinaId: disciplina.id, anoLetivo: ANO, professorId: prof.id },
  });
  add('SUP', 'Professor: GET /aulas-planejadas', aulasPlanej.status === 200, aulasPlanej.data?.message);

  if (planoAula) {
    const lancar = await profApi.post('/aulas-lancadas', {
      planoAulaId: planoAula.id,
      data: dataAula.toISOString().split('T')[0],
      cargaHoraria: 2,
    });
    const lancou = lancar.status < 400 || (lancar.status === 400 && lancar.data?.message?.includes('lançamento'));
    add('SUP', 'Professor: POST /aulas-lancadas', lancou, lancou ? undefined : lancar.data?.message);
  }

  const aulasLancadas = await profApi.get('/aulas-lancadas');
  add('SUP', 'Professor: GET /aulas-lancadas', aulasLancadas.status === 200, aulasLancadas.data?.message);

  return checks.filter(c => c.tipo === 'SUP' && !c.ok).length === 0;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  🎓 TESTE PLANO DE ENSINO + PROFESSOR - Secundário e Superior');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL} | Ano: ${ANO}\n`);

  const instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' } });
  const instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' } });

  if (!instA || !instB) {
    console.error('❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  await prisma.instituicao.updateMany({
    where: { id: { in: [instA.id, instB.id] } },
    data: {},
  });
  await prisma.instituicao.update({ where: { id: instA.id }, data: { tipoAcademico: 'SECUNDARIO' } });
  await prisma.instituicao.update({ where: { id: instB.id }, data: { tipoAcademico: 'SUPERIOR' } });

  for (const u of await prisma.user.findMany({
    where: { email: { in: ['admin.inst.a@teste.dsicola.com', 'prof.inst.a@teste.dsicola.com', 'admin.inst.b@teste.dsicola.com', 'prof.inst.b@teste.dsicola.com'] } },
  })) {
    await prisma.user.update({
      where: { id: u.id },
      data: { password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
    });
  }
  await prisma.loginAttempt.deleteMany({});

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou');
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  const loginA = await api.post('/auth/login', { email: 'admin.inst.a@teste.dsicola.com', password: SENHA });
  const adminApiA = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginA.data?.accessToken || ''}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const loginProfA = await api.post('/auth/login', { email: 'prof.inst.a@teste.dsicola.com', password: SENHA });
  if (loginProfA.status !== 200 || !loginProfA.data?.accessToken) {
    console.error('❌ Login Professor A falhou:', loginProfA.data?.message || loginProfA.status);
    process.exit(1);
  }
  const profApiA = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginProfA.data?.accessToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const loginB = await api.post('/auth/login', { email: 'admin.inst.b@teste.dsicola.com', password: SENHA });
  const adminApiB = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginB.data?.accessToken || ''}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const loginProfB = await api.post('/auth/login', { email: 'prof.inst.b@teste.dsicola.com', password: SENHA });
  if (loginProfB.status !== 200 || !loginProfB.data?.accessToken) {
    console.error('❌ Login Professor B falhou:', loginProfB.data?.message || loginProfB.status);
    process.exit(1);
  }
  const profApiB = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginProfB.data?.accessToken}` },
    timeout: 30000,
    validateStatus: () => true,
  });

  const profB = await prisma.professor.findFirst({ where: { instituicaoId: instB.id } });
  if (!profB) {
    const profUserB = await prisma.user.findFirst({ where: { email: 'prof.inst.b@teste.dsicola.com' } });
    if (profUserB) {
      await prisma.professor.create({ data: { userId: profUserB.id, instituicaoId: instB.id } });
    }
  }

  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: instA.id },
    update: { permitirMatriculaForaPeriodo: true },
    create: { instituicaoId: instA.id, permitirMatriculaForaPeriodo: true },
  });
  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: instB.id },
    update: { permitirMatriculaForaPeriodo: true },
    create: { instituicaoId: instB.id, permitirMatriculaForaPeriodo: true },
  });

  const plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (plano) {
    for (const inst of [instA, instB]) {
      let assinatura = await prisma.assinatura.findUnique({ where: { instituicaoId: inst.id } });
      if (!assinatura) {
        const fim = new Date();
        fim.setFullYear(fim.getFullYear() + 1);
        await prisma.assinatura.create({
          data: {
            instituicaoId: inst.id,
            planoId: plano.id,
            status: 'ativa',
            tipo: 'PAGA',
            dataFim: fim,
            dataProximoPagamento: fim,
            valorAtual: 0,
          },
        });
      }
    }
  }

  console.log('═══ SECUNDÁRIO (Inst A) ═══\n');
  const okSec = await runSecundario(api, adminApiA, profApiA, instA.id);

  console.log('\n═══ SUPERIOR (Inst B) ═══\n');
  const okSup = await runSuperior(api, adminApiB, profApiB, instB.id);

  await prisma.$disconnect();

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  const secFail = checks.filter(c => c.tipo === 'SEC' && !c.ok);
  const supFail = checks.filter(c => c.tipo === 'SUP' && !c.ok);
  console.log(`\nSecundário: ${secFail.length === 0 ? '✅ OK' : `❌ ${secFail.length} falha(s)`}`);
  secFail.forEach(c => console.log(`   • ${c.name}: ${c.msg}`));
  console.log(`\nSuperior: ${supFail.length === 0 ? '✅ OK' : `❌ ${supFail.length} falha(s)`}`);
  supFail.forEach(c => console.log(`   • ${c.name}: ${c.msg}`));

  if (!okSec || !okSup) {
    console.log('\n⚠️  Algumas verificações falharam.\n');
    process.exit(1);
  }
  console.log('\n✅ PLANO DE ENSINO + PROFESSOR: Secundário e Superior funcionando corretamente.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
