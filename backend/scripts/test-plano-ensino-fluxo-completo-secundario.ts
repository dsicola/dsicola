#!/usr/bin/env npx tsx
/**
 * TESTE FLUXO COMPLETO PLANO DE ENSINO - Ensino Secundário
 *
 * Garante:
 * 1. Fluxo completo: contexto → criar plano → aulas → bibliografia → atualizar → stats
 * 2. Multi-tenancy 100%: isolamento entre instituições, não aceita body.instituicaoId
 * 3. Respeito ao tipo de instituição: SECUNDARIO usa classe/classeOuAno, rejeita curso/semestre
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-plano-ensino-fluxo-completo-secundario.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-plano-ensino-fluxo-completo-secundario.ts
 *
 * Nota: Se ocorrer "Muitas tentativas de login", aguarde alguns minutos (rate limit).
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

const TEST_PROF_EMAIL = `prof.plano.sec.${Date.now()}@teste.dsicola.com`;
const TEST_PROF_PASS = 'Professor@123';

interface Result { name: string; ok: boolean; message?: string }

async function run(
  api: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<Result> {
  try {
    const r = await fn();
    const ok = r.status >= 200 && r.status < 300;
    const msg = !ok ? (r.data?.message || JSON.stringify(r.data)?.slice(0, 120)) : undefined;
    return { name, ok, message: msg };
  } catch (e: any) {
    return { name, ok: false, message: e?.response?.data?.message || e.message };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO PLANO DE ENSINO - Ensino Secundário (Multi-tenant)');
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

  console.log(`1. Instituição: ${inst.nome} (${inst.id}) tipoAcademico=${inst.tipoAcademico}\n`);

  // ─── 2. Contagem para isolamento (instituição SUPERIOR) ──────────────────────────────────
  const instSuperior = await prisma.instituicao.findFirst({
    where: { tipoAcademico: 'SUPERIOR' },
    select: { id: true },
  });
  const countSuperiorAntes = instSuperior
    ? await prisma.planoEnsino.count({ where: { instituicaoId: instSuperior.id } })
    : 0;

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 3. Login SUPER_ADMIN ─────────────────────────────────────────────────────────────
  await prisma.loginAttempt.deleteMany({ where: { email: SUPER_ADMIN_EMAIL.toLowerCase() } });
  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  // ─── 4. Admin da instituição secundária (com JWT instituicaoId + tipoAcademico) ───────
  let admin = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  if (!admin) {
    const cr = await api.post('/users', {
      email: `admin.plano.${Date.now()}@teste.dsicola.com`,
      password: SUPER_ADMIN_PASS,
      nomeCompleto: 'Admin Plano Secundário',
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

  // Resetar bloqueio de login (caso tenha excedido tentativas em testes anteriores)
  await prisma.loginAttempt.deleteMany({ where: { email: admin.email.toLowerCase() } });

  const loginAdmin = await api.post('/auth/login', { email: admin.email, password: SUPER_ADMIN_PASS });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    console.error('❌ Login ADMIN falhou:', loginAdmin.data?.message || loginAdmin.status);
    if (loginAdmin.status === 403 && loginAdmin.data?.message === 'MUST_CHANGE_PASSWORD') {
      console.error('   Admin precisa trocar senha. Execute: npm run db:seed');
    }
    process.exit(1);
  }
  const adminToken = loginAdmin.data.accessToken;
  const tipoAcad = loginAdmin.data.user?.tipoAcademico;
  if (tipoAcad !== 'SECUNDARIO') {
    console.error('❌ JWT deve ter tipoAcademico=SECUNDARIO');
    process.exit(1);
  }

  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 5. Professor ────────────────────────────────────────────────────────────────────
  const createProf = await adminApi.post('/users', {
    email: TEST_PROF_EMAIL,
    password: TEST_PROF_PASS,
    nomeCompleto: 'Professor Plano Secundário',
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

  // ─── 6. Ano letivo ATIVO ─────────────────────────────────────────────────────────────
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

  // ─── 7. Trimestre (para aulas no secundário) ───────────────────────────────────────────
  let trimestre = await prisma.trimestre.findFirst({
    where: { anoLetivoId: anoLetivo.id, instituicaoId: inst.id },
    select: { id: true, numero: true },
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
      select: { id: true, numero: true },
    }) as any;
  }

  // ─── 8. Classe e Disciplina ───────────────────────────────────────────────────────────
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

  const codigoDisc = `MAT-TEST-${Date.now()}`;
  let disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId: inst.id, codigo: codigoDisc },
    select: { id: true, nome: true },
  });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: { instituicaoId: inst.id, nome: `Matemática Teste ${Date.now()}`, codigo: codigoDisc, cargaHoraria: 120 },
      select: { id: true, nome: true },
    });
  }

  // ─── 9. MULTI-TENANT: Rejeitar instituicaoId no body ───────────────────────────────────
  console.log('9. MULTI-TENANT: Rejeitar instituicaoId no body...');
  const rejBody = await adminApi.post('/plano-ensino', {
    instituicaoId: instSuperior?.id || 'outro-uuid',
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    classeId: classe.id,
    classeOuAno: '10ª Classe',
  });
  results.push({
    name: 'Rejeita body.instituicaoId',
    ok: rejBody.status === 400 && (rejBody.data?.message || '').toLowerCase().includes('instituição'),
    message: rejBody.status !== 400 ? rejBody.data?.message : undefined,
  });

  // ─── 10. TIPO INSTITUIÇÃO: SECUNDARIO rejeita semestre ────────────────────────────────
  console.log('10. TIPO INSTITUIÇÃO: SECUNDARIO rejeita semestre...');
  const rejSemestre = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    classeId: classe.id,
    classeOuAno: '10ª Classe',
    semestre: 1,
  });
  results.push({
    name: 'SECUNDARIO rejeita semestre',
    ok: rejSemestre.status === 400 && (rejSemestre.data?.message || '').toLowerCase().includes('semestre'),
    message: rejSemestre.status !== 400 ? rejSemestre.data?.message : undefined,
  });

  // ─── 11. GET contexto (deve retornar classes, não cursos) ──────────────────────────────
  console.log('11. GET /plano-ensino/contexto...');
  const ctx = await adminApi.get('/plano-ensino/contexto');
  results.push({
    name: 'GET contexto retorna 200',
    ok: ctx.status === 200,
    message: ctx.status !== 200 ? ctx.data?.message : undefined,
  });
  if (ctx.status === 200) {
    const temClasses = Array.isArray(ctx.data?.classes) && ctx.data.classes.length > 0;
    const semCursosOuVazio = !Array.isArray(ctx.data?.cursos) || ctx.data.cursos.length === 0;
    results.push({
      name: 'Contexto SECUNDARIO: classes presente',
      ok: temClasses,
      message: temClasses ? undefined : 'Classes vazio ou ausente',
    });
    results.push({
      name: 'Contexto SECUNDARIO: cursos vazio',
      ok: semCursosOuVazio,
      message: semCursosOuVazio ? undefined : 'Cursos deveria ser vazio no secundário',
    });
  }

  // ─── 12. Criar plano de ensino (classe + classeOuAno) ──────────────────────────────────
  console.log('12. POST /plano-ensino (classe + classeOuAno)...');
  const createPlano = await adminApi.post('/plano-ensino', {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    classeId: classe.id,
    classeOuAno: '10ª Classe',
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

  // Validação no banco
  const planoDb = await prisma.planoEnsino.findFirst({
    where: { id: planoId, instituicaoId: inst.id },
    select: { classeId: true, classeOuAno: true, cursoId: true, semestre: true, instituicaoId: true },
  });
  results.push({
    name: 'Plano no banco: instituicaoId correto',
    ok: planoDb?.instituicaoId === inst.id,
  });
  results.push({
    name: 'Plano SECUNDARIO: classeId + classeOuAno',
    ok: !!planoDb?.classeId && !!planoDb?.classeOuAno,
  });
  results.push({
    name: 'Plano SECUNDARIO: sem cursoId/semestre',
    ok: planoDb?.cursoId == null && planoDb?.semestre == null,
  });

  // ─── 13. Adicionar aula planejada ──────────────────────────────────────────────────────
  console.log('13. POST aula planejada...');
  const createAula = await adminApi.post(`/plano-ensino/${planoId}/aulas`, {
    titulo: 'Introdução à Matemática',
    descricao: 'Conceitos iniciais',
    tipo: 'TEORICA',
    quantidadeAulas: 4,
  });
  results.push({
    name: 'Criar aula planejada',
    ok: createAula.status >= 200 && createAula.status < 300,
    message: createAula.status >= 400 ? createAula.data?.message : undefined,
  });
  const aulaId = createAula.status >= 200 && createAula.status < 300 ? createAula.data?.id : null;

  // ─── 14. Adicionar bibliografia ────────────────────────────────────────────────────────
  console.log('14. POST bibliografia...');
  const createBib = await adminApi.post(`/plano-ensino/${planoId}/bibliografias`, {
    titulo: 'Matemática Básica',
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

  // ─── 15. GET stats e carga-horaria ─────────────────────────────────────────────────────
  console.log('15. GET stats e carga-horaria...');
  const stats = await adminApi.get(`/plano-ensino/${planoId}/stats`);
  const carga = await adminApi.get(`/plano-ensino/${planoId}/carga-horaria`);
  results.push({ name: 'GET stats', ok: stats.status === 200 });
  results.push({ name: 'GET carga-horaria', ok: carga.status === 200 });

  // ─── 16. Atualizar plano ──────────────────────────────────────────────────────────────
  console.log('16. PUT plano (metodologia)...');
  const updatePlano = await adminApi.put(`/plano-ensino/${planoId}`, {
    metodologia: 'Metodologia atualizada',
  });
  results.push({
    name: 'Atualizar plano',
    ok: updatePlano.status === 200,
    message: updatePlano.status >= 400 ? updatePlano.data?.message : undefined,
  });

  // ─── 17. MULTI-TENANT: Admin de outra instituição NÃO acessa plano ────────────────────
  if (instSuperior) {
    console.log('17. MULTI-TENANT: Admin outra instituição não acessa plano...');
    const adminOutra = await prisma.user.findFirst({
      where: { instituicaoId: instSuperior.id, roles: { some: { role: 'ADMIN' } } },
      select: { id: true, email: true },
    });
    if (adminOutra) {
      const hash = await bcrypt.hash(SUPER_ADMIN_PASS, 10);
      await prisma.user.update({
        where: { id: adminOutra.id },
        data: { password: hash, mustChangePassword: false },
      });
      await prisma.loginAttempt.deleteMany({ where: { email: adminOutra.email.toLowerCase() } });
      const loginOutra = await api.post('/auth/login', { email: adminOutra.email, password: SUPER_ADMIN_PASS });
      if (loginOutra.status === 200 && loginOutra.data?.accessToken) {
        const apiOutra = axios.create({
          baseURL: API_URL,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginOutra.data.accessToken}` },
          timeout: 20000,
          validateStatus: () => true,
        });
        const getPlanoOutra = await apiOutra.get(`/plano-ensino/${planoId}/stats`);
        results.push({
          name: 'Outra inst NÃO acessa plano (404 ou vazio)',
          ok: getPlanoOutra.status === 404 || (getPlanoOutra.status === 200 && !getPlanoOutra.data),
          message: getPlanoOutra.status === 200 && getPlanoOutra.data ? 'Outra inst acessou dados!' : undefined,
        });
      }
    }
  }

  // ─── 18. Isolamento: Ensino Superior inalterado ────────────────────────────────────────
  const countSuperiorDepois = instSuperior
    ? await prisma.planoEnsino.count({ where: { instituicaoId: instSuperior.id } })
    : 0;
  results.push({
    name: 'Isolamento: Superior inalterado',
    ok: countSuperiorDepois === countSuperiorAntes,
    message: countSuperiorDepois !== countSuperiorAntes ? `Superior: ${countSuperiorAntes} -> ${countSuperiorDepois}` : undefined,
  });

  // ─── 19. GET plano (listar) ───────────────────────────────────────────────────────────
  const list = await adminApi.get('/plano-ensino', { params: { anoLetivoId: anoLetivo.id } });
  results.push({
    name: 'GET plano-ensino (listar)',
    ok: list.status === 200 && Array.isArray(list.data) && list.data.some((p: any) => p.id === planoId),
  });

  await prisma.$disconnect();

  // ─── Resultado final ─────────────────────────────────────────────────────────────────
  printResults(results);
  const falhas = results.filter((r) => !r.ok);
  if (falhas.length > 0) {
    process.exit(1);
  }
  console.log('\n✅ TESTE PASSOU: Fluxo completo Plano de Ensino Secundário 100% multi-tenant e respeitando tipo de instituição.\n');
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
