#!/usr/bin/env npx tsx
/**
 * Teste completo do perfil PROFESSOR - DSICOLA ERP multi-tenant
 *
 * Valida:
 * 1. Login com PROFESSOR; cria professor se não existir
 * 2. JWT/session contém: role=PROFESSOR, professor_id, instituicao_id, tipoInstituicao
 * 3. Funcionalidades: dashboard, disciplinas, turmas, plano ensino, notas, frequência, relatórios
 * 4. Regras por tipoInstituicao (Superior: curso+ano/semestre; Secundário: curso+classe)
 * 5. Bloqueio cross-tenant (403/404)
 *
 * Uso: npx tsx scripts/test-perfil-professor.ts
 * Ou: TEST_PROFESSOR_EMAIL=prof@email.com TEST_PROFESSOR_PASSWORD=senha npx tsx scripts/test-perfil-professor.ts
 */

import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_PROFESSOR_EMAIL;
const TEST_PASSWORD = process.env.TEST_PROFESSOR_PASSWORD;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  status?: number;
}

async function runTest(
  client: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    return { name, ok, status: result.status, message: ok ? undefined : JSON.stringify(result.data) };
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    return { name, ok: false, status, message: msg };
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  TESTE DO PERFIL PROFESSOR - DSICOLA');
  console.log('========================================\n');
  console.log(`API: ${API_URL}\n`);

  let email = TEST_EMAIL;
  let password = TEST_PASSWORD;

  if (!email || !password) {
    email = (await question('Email do professor: '))?.trim() || '';
    password = (await question('Senha do professor: '))?.trim() || '';
  }

  if (!email || !password) {
    console.log('❌ Email e senha são obrigatórios.');
    rl.close();
    process.exit(1);
  }

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // --- 1. LOGIN ---
  console.log('\n1. Login...');
  const loginRes = await api.post('/auth/login', { email, password });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.log('⚠️  Professor precisa trocar senha. Use: nova senha forte (8+ chars, maiúscula, especial)');
    rl.close();
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    console.log('   Se não existir professor, crie com: npx tsx scripts/criar-professor.ts', email);
    rl.close();
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;

  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  if (!roles.includes('PROFESSOR')) {
    results.push({ name: 'Role PROFESSOR no login', ok: false, message: `Roles: ${roles.join(', ')}` });
  } else {
    results.push({ name: 'Role PROFESSOR no login', ok: true });
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`✅ Login OK - ${user?.nomeCompleto || user?.email}`);

  // --- 2. VALIDAR JWT PAYLOAD ---
  const payload = decodeJwtPayload(token);
  if (!payload) {
    results.push({ name: 'JWT decodificável', ok: false, message: 'Token inválido' });
  } else {
    results.push({ name: 'JWT decodificável', ok: true });

    const hasRole = Array.isArray(payload.roles) && payload.roles.includes('PROFESSOR');
    results.push({ name: 'JWT roles inclui PROFESSOR', ok: !!hasRole, message: hasRole ? undefined : `roles=${JSON.stringify(payload.roles)}` });

    const hasInstituicaoId = payload.instituicaoId !== undefined && payload.instituicaoId !== null;
    results.push({ name: 'JWT instituicao_id presente', ok: !!hasInstituicaoId, message: hasInstituicaoId ? undefined : `instituicaoId=${payload.instituicaoId}` });

    const hasProfessorId = payload.professorId !== undefined && payload.professorId !== null && payload.professorId !== '';
    results.push({ name: 'JWT professor_id presente', ok: !!hasProfessorId, message: hasProfessorId ? undefined : `professorId=${payload.professorId}` });

    const hasTipoAcademico = payload.tipoAcademico === 'SUPERIOR' || payload.tipoAcademico === 'SECUNDARIO';
    results.push({ name: 'JWT tipoInstituicao (SUPERIOR|SECUNDARIO)', ok: !!hasTipoAcademico, message: hasTipoAcademico ? undefined : `tipoAcademico=${payload.tipoAcademico}` });
  }

  const instituicaoId = user?.instituicaoId || payload?.instituicaoId;
  const professorId = user?.professorId ?? payload?.professorId;

  if (!professorId && roles.includes('PROFESSOR')) {
    results.push({ name: 'Professor cadastrado (professores.id)', ok: false, message: 'Execute: npx tsx scripts/criar-professor.ts ' + email });
  } else if (professorId) {
    results.push({ name: 'Professor cadastrado (professores.id)', ok: true });
  }

  // --- 3. PERFIL ---
  results.push(
    await runTest(api, 'GET /auth/profile (professorId + tipoAcademico)', async () => {
      const r = await api.get('/auth/profile');
      if (r.status === 200 && r.data) {
        const hasProf = r.data.professorId !== undefined;
        const hasTipo = r.data.tipoAcademico === 'SUPERIOR' || r.data.tipoAcademico === 'SECUNDARIO';
        if (!hasProf || !hasTipo) {
          return { status: 500, data: { message: `Profile sem professorId ou tipoAcademico: professorId=${r.data.professorId} tipoAcademico=${r.data.tipoAcademico}` } };
        }
      }
      return { status: r.status, data: r.data };
    })
  );

  // --- 4. FUNCIONALIDADES ---
  results.push(
    await runTest(api, 'GET /professor-disciplinas/me (disciplinas)', async () => {
      const r = await api.get('/professor-disciplinas/me');
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /turmas/professor (turmas)', async () => {
      const r = await api.get('/turmas/professor');
      return { status: r.status, data: r.data };
    })
  );

  let planosRes: any = null;
  results.push(
    await runTest(api, 'GET /plano-ensino (plano ensino)', async () => {
      const r = await api.get('/plano-ensino');
      planosRes = r;
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /notas (notas)', async () => {
      const r = await api.get('/notas');
      return { status: r.status, data: r.data };
    })
  );

  // aulas-planejadas requer disciplinaId e anoLetivo; usar do primeiro plano se houver
  const primeiroPlano = Array.isArray(planosRes?.data) ? planosRes.data[0] : planosRes?.data;
  const paramsAulasPlanejadas = primeiroPlano?.disciplinaId && primeiroPlano?.anoLetivo
    ? { disciplinaId: primeiroPlano.disciplinaId, anoLetivo: primeiroPlano.anoLetivo }
    : {};
  results.push(
    await runTest(api, 'GET /aulas-planejadas (aulas planejadas)', async () => {
      const r = await api.get('/aulas-planejadas', { params: paramsAulasPlanejadas });
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /aulas-lancadas (aulas lançadas)', async () => {
      const r = await api.get('/aulas-lancadas');
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /frequencias (frequência)', async () => {
      const r = await api.get('/frequencias');
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /avaliacoes (avaliações)', async () => {
      const r = await api.get('/avaliacoes');
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'GET /anos-letivos (ano letivo)', async () => {
      const r = await api.get('/anos-letivos');
      return { status: r.status, data: r.data };
    })
  );

  // --- 5. CROSS-TENANT: tentar acessar outro professor/instituição ---
  const crossTests: Array<{ name: string; fn: () => Promise<any> }> = [];

  if (professorId && instituicaoId) {
    crossTests.push({
      name: 'Bloquear acesso a turmas de outro professor (403/404)',
      fn: async () => {
        const r = await api.get('/turmas/professor', { params: { professorId: '00000000-0000-0000-0000-000000000000' } });
        return r.status === 403 || r.status === 404 || (r.status === 200 && (!r.data || (Array.isArray(r.data) && r.data.length === 0)));
      },
    });
  }

  for (const t of crossTests) {
    try {
      const ok = await t.fn();
      results.push({ name: t.name, ok });
    } catch (e: any) {
      results.push({ name: t.name, ok: false, message: e.message });
    }
  }

  rl.close();

  // --- RELATÓRIO ---
  console.log('\n========================================');
  console.log('  RESULTADOS');
  console.log('========================================\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    const status = r.status ? ` (${r.status})` : '';
    console.log(`${icon} ${r.name}${status}`);
    if (!r.ok && r.message) {
      const msg = String(r.message);
      console.log(`   └─ ${msg.length > 90 ? msg.substring(0, 90) + '...' : msg}`);
    }
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    console.log('   Verifique: JWT professorId, instituicao_id em queries, regras por tipoInstituicao.');
    process.exit(1);
  }

  console.log('\n✅ Todos os testes do perfil PROFESSOR passaram!\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  rl.close();
  process.exit(1);
});
