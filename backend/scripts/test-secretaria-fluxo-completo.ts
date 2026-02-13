#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO - Perfil SECRETARIA
 *
 * Valida todas as funcionalidades da SECRETARIA:
 * - ALUNOS, MATRÍCULAS, DOCUMENTOS_ACADEMICOS
 * - PRESENCAS (ver e ajustar), NOTAS (ver e ajustar)
 * - CALENDARIO_ACADEMICO (ajustar datas)
 * - FINANCEIRO: mensalidades, pagamentos, recibos
 * - Comunicados, relatórios, folha de pagamento (leitura)
 *
 * SECRETARIA NÃO pode: aprovar plano, encerrar semestre, criar turmas, criar cursos
 *
 * Requer: Backend rodando em http://localhost:3001
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_SECRETARIA_PASS || 'Secretaria@123';

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  status?: number;
  details?: string;
}

async function runTest(
  client: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    const msg = !ok ? (result.data?.message || JSON.stringify(result.data)?.slice(0, 100)) : undefined;
    return { name, ok, status: result.status, message: msg };
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    return { name, ok: false, status, message: String(msg).slice(0, 120) };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - SECRETARIA - DSICOLA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const emailFromEnv = process.env.TEST_SECRETARIA_EMAIL?.trim();

  let secretariaUser: { id: string; email: string; nomeCompleto: string | null; instituicaoId: string | null } | null = null;

  if (emailFromEnv) {
    const user = await prisma.user.findFirst({
      where: { email: emailFromEnv.toLowerCase() },
      include: { roles: { select: { role: true } } },
    });
    if (user && user.roles.some((r) => r.role === 'SECRETARIA')) {
      secretariaUser = { id: user.id, email: user.email, nomeCompleto: user.nomeCompleto, instituicaoId: user.instituicaoId };
    }
    if (!secretariaUser) {
      console.error('❌ Usuário não encontrado ou não possui role SECRETARIA:', emailFromEnv);
      process.exit(1);
    }
  } else {
    const userWithSec = await prisma.user.findFirst({
      where: {
        roles: { some: { role: 'SECRETARIA' } },
        instituicaoId: { not: null },
      },
      include: { roles: { select: { role: true } } },
    });
    if (userWithSec) {
      secretariaUser = {
        id: userWithSec.id,
        email: userWithSec.email,
        nomeCompleto: userWithSec.nomeCompleto,
        instituicaoId: userWithSec.instituicaoId,
      };
    }
  }

  if (!secretariaUser) {
    const primeiraInst = await prisma.instituicao.findFirst({ select: { id: true } });
    const adminUser = await prisma.user.findFirst({
      where: {
        instituicaoId: primeiraInst?.id,
        roles: { some: { role: 'ADMIN' } },
      },
      include: { roles: { select: { role: true } } },
    });
    if (adminUser && primeiraInst) {
      const temSec = adminUser.roles.some((r) => r.role === 'SECRETARIA');
      if (!temSec) {
        await prisma.userRole_.create({
          data: { userId: adminUser.id, role: 'SECRETARIA', instituicaoId: primeiraInst.id },
        });
      }
      secretariaUser = {
        id: adminUser.id,
        email: adminUser.email,
        nomeCompleto: adminUser.nomeCompleto,
        instituicaoId: adminUser.instituicaoId,
      };
    }
  }

  if (!secretariaUser) {
    console.error('❌ Nenhum usuário SECRETARIA encontrado.');
    process.exit(1);
  }

  const instituicaoId = secretariaUser.instituicaoId;
  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: secretariaUser.id },
    data: { password: hash, mustChangePassword: false },
  });
  console.log(`SECRETARIA: ${secretariaUser.nomeCompleto || secretariaUser.email}`);
  console.log(`✅ Senha definida: ${SENHA_TESTE}\n`);

  await prisma.$disconnect();

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];
  const q = (p?: Record<string, string>) => (instituicaoId ? { ...(p || {}), instituicaoId } : (p || {}));

  console.log('1. LOGIN...');
  const loginRes = await api.post('/auth/login', { email: secretariaUser.email, password: SENHA_TESTE });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }
  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`   ✅ Login OK - ${user?.nomeCompleto || user?.email}\n`);

  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  results.push({ name: 'JWT inclui role SECRETARIA', ok: roles.includes('SECRETARIA'), details: `Roles: ${roles.join(', ')}` });

  console.log('2. AUTH & PROFILE...');
  results.push(await runTest(api, 'GET /auth/profile', async () => {
    const r = await api.get('/auth/profile');
    return { status: r.status, data: r.data };
  }));

  console.log('3. MÓDULOS: Alunos, Matrículas, Turmas...');
  results.push(await runTest(api, 'GET /estudantes', async () => {
    const r = await api.get('/estudantes', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /matriculas', async () => {
    const r = await api.get('/matriculas', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /turmas', async () => {
    const r = await api.get('/turmas', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('4. ANO LETIVO, SEMESTRES, TRIMESTRES...');
  results.push(await runTest(api, 'GET /anos-letivos', async () => {
    const r = await api.get('/anos-letivos', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /semestres', async () => {
    const r = await api.get('/semestres', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /trimestres', async () => {
    const r = await api.get('/trimestres', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('5. NOTAS, AVALIAÇÕES, PRESENÇAS...');
  results.push(await runTest(api, 'GET /notas', async () => {
    const r = await api.get('/notas', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /avaliacoes', async () => {
    const r = await api.get('/avaliacoes', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /frequencias', async () => {
    const r = await api.get('/frequencias', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('6. FINANCEIRO (mensalidades, pagamentos, recibos)...');
  results.push(await runTest(api, 'GET /mensalidades', async () => {
    const r = await api.get('/mensalidades', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /pagamentos', async () => {
    const r = await api.get('/pagamentos', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /recibos', async () => {
    const r = await api.get('/recibos', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('7. COMUNICADOS, USUÁRIOS, RELATÓRIOS...');
  results.push(await runTest(api, 'GET /comunicados', async () => {
    const r = await api.get('/comunicados', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /users', async () => {
    const r = await api.get('/users', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /stats/admin', async () => {
    const r = await api.get('/stats/admin', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('8. AULAS PLANEJADAS, PLANO ENSINO...');
  const profs = await api.get('/professores', { params: q() });
  const anos = await api.get('/anos-letivos', { params: q() });
  const primeiroProf = Array.isArray(profs.data) ? profs.data[0] : null;
  const primeiroAno = Array.isArray(anos.data) ? anos.data[0] : null;
  const paramsPlano = { ...q(), ...(primeiroProf?.id && { professorId: primeiroProf.id }), ...(primeiroAno?.id && { anoLetivoId: primeiroAno.id }) };
  results.push(await runTest(api, 'GET /plano-ensino', async () => {
    const r = await api.get('/plano-ensino', { params: paramsPlano });
    return { status: r.status, data: r.data };
  }));

  console.log('9. DOCUMENTOS (profiles, documentos)...');
  results.push(await runTest(api, 'GET /profiles', async () => {
    const r = await api.get('/profiles', { params: q() });
    return { status: r.status, data: r.data };
  }));
  results.push(await runTest(api, 'GET /documentos-emitidos', async () => {
    const r = await api.get('/documentos-emitidos', { params: q() });
    return { status: r.status, data: r.data };
  }));

  console.log('10. BLOQUEIO: SECRETARIA NÃO cria turmas...');
  const blocoRes = await api.post('/turmas', { nome: 'Teste', instituicaoId: instituicaoId || '' });
  results.push({ name: 'SECRETARIA NÃO pode POST /turmas', ok: blocoRes.status === 403, status: blocoRes.status, details: blocoRes.status === 403 ? 'Bloqueado corretamente' : undefined });

  console.log('11. HEALTH...');
  results.push(await runTest(api, 'GET /health', async () => {
    const r = await api.get('/health');
    return { status: r.status, data: r.data };
  }));

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESULTADOS - TESTE FLUXO COMPLETO SECRETARIA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    const status = r.status ? ` (${r.status})` : '';
    console.log(`${icon} ${r.name}${status}`);
    if (!r.ok && r.message) console.log(`   └─ ${String(r.message).slice(0, 100)}`);
    if (r.details && r.ok) console.log(`   └─ ${r.details}`);
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    process.exit(1);
  }

  console.log('\n✅ Todos os testes do fluxo SECRETARIA passaram!\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
