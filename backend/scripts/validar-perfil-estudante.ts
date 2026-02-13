/**
 * VALIDAÇÃO COMPLETA DO PERFIL ESTUDANTE - DSICOLA
 *
 * Executa: 1) Criar estudante se não existir
 *         2) Validar JWT (role, student_id, instituicao_id, tipoInstituicao)
 *         3) Testar todas as rotas do perfil
 *         4) Testar bloqueio cross-tenant e acesso a outro aluno
 *
 * Uso: TEST_ALUNO_EMAIL=x@y.com TEST_ALUNO_PASSWORD=senha npm run script:validar-perfil-estudante
 *      Ou será solicitado interativamente.
 */

import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_ALUNO_EMAIL;
const TEST_PASSWORD = process.env.TEST_ALUNO_PASSWORD;

const prisma = new PrismaClient();
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

async function ensureStudentExists(): Promise<{ email: string; password: string } | null> {
  const existing = await prisma.user.findFirst({
    where: { roles: { some: { role: 'ALUNO' } }, instituicaoId: { not: null } },
    include: { instituicao: { select: { id: true, nome: true } } },
  });

  if (existing) {
    return {
      email: existing.email,
      password: TEST_PASSWORD || '(solicitar ao usuário)',
    };
  }

  // Criar estudante de teste se não existir
  const inst = await prisma.instituicao.findFirst();
  if (!inst) return null;

  const email = TEST_EMAIL || `aluno.teste.${Date.now()}@dsicola.test`;
  const password = TEST_PASSWORD || 'Teste123!';
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      password: hash,
      nomeCompleto: 'Aluno Teste Validação',
      instituicaoId: inst.id,
    },
    update: { password: hash },
  });

  await prisma.userRole_.upsert({
    where: {
      userId_role: { userId: user.id, role: 'ALUNO' },
    },
    create: { userId: user.id, role: 'ALUNO', instituicaoId: inst.id },
    update: {},
  });

  return { email: user.email, password };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO PERFIL ESTUDANTE - DSICOLA ERP MULTI-TENANT       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  let email = TEST_EMAIL;
  let password = TEST_PASSWORD;

  if (!email || !password) {
    const ensured = await ensureStudentExists();
    if (ensured) {
      if (ensured.password === '(solicitar ao usuário)') {
        email = ensured.email;
        password = (await question(`Senha para ${email}: `))?.trim() || '';
      } else {
        email = ensured.email;
        password = ensured.password;
        console.log(`\n1. Estudante: ${email} (criado/encontrado)`);
      }
    } else {
      email = (await question('Email do estudante: '))?.trim() || '';
      password = (await question('Senha do estudante: '))?.trim() || '';
    }
  }

  if (!email || !password) {
    console.log('❌ Email e senha são obrigatórios.');
    rl.close();
    process.exit(1);
  }

  // 1. Login
  console.log('\n2. Login e validação JWT...');
  const loginRes = await api.post('/auth/login', { email, password });

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    rl.close();
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;

  // Decodificar JWT (sem verificar assinatura para inspeção)
  const decoded = jwt.decode(token) as any;
  const jwtPayload = decoded || {};

  const hasRoleAluno = (user?.roles || []).includes('ALUNO') || (jwtPayload?.roles || []).includes('ALUNO');
  const studentId = jwtPayload?.sub || jwtPayload?.userId || user?.id;
  const instituicaoId = jwtPayload?.instituicaoId ?? user?.instituicaoId;
  const tipoInstituicao = jwtPayload?.tipoAcademico ?? user?.tipoAcademico;

  console.log('   JWT payload:');
  console.log(`   - role=ALUNO: ${hasRoleAluno ? '✅' : '❌'}`);
  console.log(`   - student_id (sub/userId): ${studentId ? '✅ ' + studentId : '❌'}`);
  console.log(`   - instituicao_id: ${instituicaoId ? '✅ ' + instituicaoId : '⚠️ null'}`);
  console.log(`   - tipoInstituicao (tipoAcademico): ${tipoInstituicao ? '✅ ' + tipoInstituicao : '⚠️ null (opcional para ALUNO)'}`);

  if (!hasRoleAluno || !studentId) {
    console.log('\n❌ JWT inválido para perfil estudante.');
    rl.close();
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`\n✅ Login OK - ${user?.nomeCompleto || user?.email}`);

  const results: TestResult[] = [];

  // 3. Testar rotas do perfil
  console.log('\n3. Testando rotas do perfil...');

  const routes = [
    ['GET /auth/profile', () => api.get('/auth/profile')],
    ['GET /matriculas/aluno', () => api.get('/matriculas/aluno')],
    ['GET /matriculas-anuais/meus-anos-letivos', () => api.get('/matriculas-anuais/meus-anos-letivos')],
    ['GET /notas/aluno', () => api.get('/notas/aluno')],
    ['GET /frequencias/aluno', () => api.get('/frequencias/aluno')],
    ['GET /mensalidades/aluno', () => api.get('/mensalidades/aluno')],
    ['GET /eventos', () => api.get('/eventos')],
    ['GET /comunicados/publicos', () => api.get('/comunicados/publicos')],
    ['GET /documentos-aluno', () => api.get('/documentos-aluno', { params: { alunoId: studentId } })],
    ['GET /relatorios/boletim/:id', () => api.get(`/relatorios/boletim/${studentId}`)],
    ['GET /relatorios/historico/:id', () => api.get(`/relatorios/historico/${studentId}`)],
    ['GET /biblioteca/itens', () => api.get('/biblioteca/itens')],
    ['GET /biblioteca/meus-emprestimos', () => api.get('/biblioteca/meus-emprestimos')],
  ];

  for (const [name, fn] of routes) {
    results.push(
      await runTest(api, name, async () => {
        const r = await fn();
        return { status: r.status, data: r.data };
      })
    );
  }

  // 4. Bloqueio cross-tenant / outro aluno (403 ou 404)
  console.log('\n4. Testando bloqueio acesso a outro aluno...');
  const fakeAlunoId = '00000000-0000-4000-8000-000000000000';
  const bloqueioBoletim = await api.get(`/relatorios/boletim/${fakeAlunoId}`);
  const bloqueioHistorico = await api.get(`/relatorios/historico/${fakeAlunoId}`);

  const bloqueioOk =
    (bloqueioBoletim.status === 403 || bloqueioBoletim.status === 404) &&
    (bloqueioHistorico.status === 403 || bloqueioHistorico.status === 404);

  results.push({
    name: 'BLOQUEIO cross-aluno (403/404)',
    ok: bloqueioOk,
    status: bloqueioBoletim.status,
    message: bloqueioOk ? undefined : `boletim=${bloqueioBoletim.status}, historico=${bloqueioHistorico.status}`,
  });

  rl.close();

  // Relatório
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  RELATÓRIO FINAL');
  console.log('══════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅ PASS' : '❌ FAIL';
    const status = r.status ? ` (${r.status})` : '';
    console.log(`${icon} ${r.name}${status}`);
    if (!r.ok && r.message) {
      console.log(`      └─ ${String(r.message).substring(0, 100)}`);
    }
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    process.exit(1);
  }

  console.log('\n✅ VALIDAÇÃO PERFIL ESTUDANTE: APROVADO\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  rl.close();
  process.exit(1);
}).finally(() => prisma.$disconnect());
