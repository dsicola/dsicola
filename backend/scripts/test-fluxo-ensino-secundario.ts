#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo Ensino Secundário - Admin cadastrando Cursos, Classes e Turmas
 *
 * Simula o fluxo de um ADMIN em instituição de ensino secundário:
 * 1. Login como ADMIN da instituição secundária
 * 2. Criar ano letivo (se não existir)
 * 3. Criar curso (área/opção - Ensino Secundário)
 * 4. Criar classe (ano - com mensalidade)
 * 5. Criar turma (vinculada a classe e ano letivo)
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-fluxo-ensino-secundario.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-fluxo-ensino-secundario.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'Admin@123';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const INSTITUICAO_ID = process.env.INSTITUICAO_ID;

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  details?: string;
}

async function runTest(
  api: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    const msg = !ok ? (result.data?.message || JSON.stringify(result.data)?.slice(0, 120)) : undefined;
    return { name, ok, message: msg };
  } catch (err: any) {
    return {
      name,
      ok: false,
      message: (err.response?.data?.message || err.message || '').slice(0, 120),
    };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo Completo Ensino Secundário - Cursos, Classes e Turmas');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // ─── 1. LOGIN SUPER_ADMIN para obter lista de instituições ─────────────────────────────
  console.log('1. Login e busca de instituição secundária...');
  const superLogin = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });

  if (superLogin.status !== 200 || !superLogin.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou:', superLogin.data?.message || superLogin.statusText);
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${superLogin.data.accessToken}`;

  // Buscar instituição secundária
  let instituicao: { id: string; nome: string; tipoAcademico: string | null } | null;

  if (INSTITUICAO_ID) {
    instituicao = await prisma.instituicao.findUnique({
      where: { id: INSTITUICAO_ID },
      select: { id: true, nome: true, tipoAcademico: true },
    });
  } else {
    const lista = await prisma.instituicao.findMany({
      where: {
        OR: [{ tipoAcademico: 'SECUNDARIO' }, { tipoInstituicao: 'ENSINO_MEDIO' }],
      },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    instituicao = lista[0] ?? (await prisma.instituicao.findFirst({ select: { id: true, nome: true, tipoAcademico: true } }));
  }

  if (!instituicao) {
    console.error('❌ Nenhuma instituição encontrada. Crie uma instituição de ensino secundário primeiro.');
    process.exit(1);
  }

  console.log(`   Instituição: ${instituicao.nome} (${instituicao.id})\n`);

  // ─── 2. Buscar ADMIN da instituição e fazer login ──────────────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId: instituicao.id,
      roles: { some: { role: 'ADMIN' } },
    },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!adminUser) {
    console.error('❌ Nenhum usuário ADMIN encontrado na instituição. Cadastre um ADMIN primeiro.');
    process.exit(1);
  }

  // Garantir senha conhecida
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { password: hash, mustChangePassword: false },
  });

  const adminLogin = await api.post('/auth/login', {
    email: adminUser.email,
    password: ADMIN_PASS,
  });

  if (adminLogin.status !== 200 || !adminLogin.data?.accessToken) {
    console.error('❌ Login ADMIN falhou:', adminLogin.data?.message);
    process.exit(1);
  }

  const adminToken = adminLogin.data.accessToken;
  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    timeout: 20000,
    validateStatus: () => true,
  });

  console.log(`   ✅ Login como ADMIN: ${adminUser.email}\n`);

  const q = () => ({ instituicaoId: instituicao!.id });

  // ─── 3. Ano Letivo ──────────────────────────────────────────────────────────────────
  console.log('2. Ano Letivo...');
  let anoLetivoId: string | null = null;
  let anoLetivoAno: number | null = null;

  const anosRes = await adminApi.get('/anos-letivos', { params: q() });
  const anosLetivos = Array.isArray(anosRes.data) ? anosRes.data : [];

  if (anosLetivos.length > 0) {
    const primeiro = anosLetivos[0];
    anoLetivoId = primeiro.id;
    anoLetivoAno = primeiro.ano;
    results.push({ name: 'GET /anos-letivos', ok: true, details: `Usando ano ${anoLetivoAno} existente` });
  } else {
    const anoAtual = new Date().getFullYear();
    const createAnoRes = await adminApi.post('/anos-letivos', {
      ano: anoAtual,
      dataInicio: `${anoAtual}-01-15`,
      dataFim: `${anoAtual}-12-20`,
      observacoes: 'Teste fluxo ensino secundário',
    });

    if (createAnoRes.status >= 200 && createAnoRes.status < 300) {
      anoLetivoId = createAnoRes.data?.id;
      anoLetivoAno = createAnoRes.data?.ano;
      results.push({ name: 'POST /anos-letivos (criar)', ok: true, details: `Ano ${anoLetivoAno} criado` });
    } else {
      results.push({
        name: 'POST /anos-letivos (criar)',
        ok: false,
        message: createAnoRes.data?.message || 'Erro ao criar ano letivo',
      });
    }
  }

  if (!anoLetivoId) {
    console.error('❌ Não foi possível obter ano letivo.');
    printResults(results);
    process.exit(1);
  }

  // ─── 4. Curso (Ensino Secundário: área/opção, sem mensalidade) ────────────────────────
  console.log('3. Curso (área/opção)...');
  const cursoCodigo = `CURSO-TEST-${Date.now().toString(36).slice(-6)}`;
  const createCursoRes = await adminApi.post('/cursos', {
    nome: 'Curso Teste Ensino Secundário',
    codigo: cursoCodigo,
    cargaHoraria: 1200,
    valorMensalidade: 0,
    descricao: 'Curso de teste para fluxo ensino secundário',
  });

  let cursoId: string | null = null;
  if (createCursoRes.status >= 200 && createCursoRes.status < 300) {
    cursoId = createCursoRes.data?.id;
    results.push({ name: 'POST /cursos (criar)', ok: true, details: cursoCodigo });
  } else {
    results.push({
      name: 'POST /cursos (criar)',
      ok: false,
      message: createCursoRes.data?.message || 'Erro ao criar curso',
    });
  }

  // ─── 5. Classe (Ensino Secundário: ano com mensalidade) ───────────────────────────────
  console.log('4. Classe (ano com mensalidade)...');
  const classeCodigo = `CLASSE-TEST-${Date.now().toString(36).slice(-6)}`;
  const createClasseRes = await adminApi.post('/classes', {
    nome: '10ª Classe - Teste',
    codigo: classeCodigo,
    cargaHoraria: 0,
    valorMensalidade: 50000,
    descricao: 'Classe de teste para fluxo ensino secundário',
  });

  let classeId: string | null = null;
  if (createClasseRes.status >= 200 && createClasseRes.status < 300) {
    classeId = createClasseRes.data?.id;
    results.push({ name: 'POST /classes (criar)', ok: true, details: classeCodigo });
  } else {
    results.push({
      name: 'POST /classes (criar)',
      ok: false,
      message: createClasseRes.data?.message || 'Erro ao criar classe',
    });
  }

  if (!classeId) {
    console.error('❌ Não foi possível criar classe. Verifique se a instituição tem tipoAcademico = SECUNDARIO.');
    printResults(results);
    process.exit(1);
  }

  // ─── 6. Turma (Ensino Secundário: classeId obrigatório, cursoId opcional) ────────────
  console.log('5. Turma...');
  const turmaNome = `Turma 10A - Teste ${Date.now().toString(36).slice(-6)}`;
  const createTurmaRes = await adminApi.post('/turmas', {
    nome: turmaNome,
    classeId,
    cursoId: cursoId || undefined,
    anoLetivoId,
    capacidade: 35,
    sala: 'Sala 101',
  });

  let turmaId: string | null = null;
  if (createTurmaRes.status >= 200 && createTurmaRes.status < 300) {
    turmaId = createTurmaRes.data?.id;
    results.push({ name: 'POST /turmas (criar)', ok: true, details: turmaNome });
  } else {
    results.push({
      name: 'POST /turmas (criar)',
      ok: false,
      message: createTurmaRes.data?.message || 'Erro ao criar turma',
    });
  }

  // ─── 7. Verificações finais ──────────────────────────────────────────────────────────
  console.log('6. Verificações...');
  results.push(
    await runTest(adminApi, 'GET /cursos', async () => {
      const r = await adminApi.get('/cursos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /classes', async () => {
      const r = await adminApi.get('/classes');
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /turmas', async () => {
      const r = await adminApi.get('/turmas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── RESULTADO ──────────────────────────────────────────────────────────────────────
  printResults(results);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exit(1);
  }

  console.log('\n✅ TESTE PASSOU: Fluxo completo de cadastro (Cursos → Classes → Turmas) no Ensino Secundário.\n');
}

function printResults(results: TestResult[]) {
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  console.log('  RESULTADOS');
  console.log('───────────────────────────────────────────────────────────────────────────────\n');

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    const detail = r.details ? ` (${r.details})` : '';
    const msg = r.message ? `: ${r.message}` : '';
    console.log(`  ${icon} ${r.name}${detail}${msg}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
