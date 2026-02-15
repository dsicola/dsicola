#!/usr/bin/env npx tsx
/**
 * TESTE DE PERFIS RH E FINANCEIRO - DSICOLA
 *
 * Valida a implementação de perfis por departamento:
 * - RH: login, redirect para recursos-humanos, acesso a rotas RH (funcionários, folha), bloqueio de rotas não-RH
 * - FINANCEIRO: login, redirect para pagamentos, acesso a rotas financeiras (mensalidades, pagamentos), bloqueio de rotas não-financeiras
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:rh-financeiro
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_RH_FINANCEIRO_PASS || 'RhFinanceiro@123';

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

async function findOrCreateUserWithRole(role: 'RH' | 'FINANCEIRO') {
  const userWithRole = await prisma.user.findFirst({
    where: {
      roles: { some: { role } },
      instituicaoId: { not: null },
    },
    include: { roles: { select: { role: true } } },
  });

  if (userWithRole) {
    return {
      id: userWithRole.id,
      email: userWithRole.email,
      nomeCompleto: userWithRole.nomeCompleto,
      instituicaoId: userWithRole.instituicaoId,
    };
  }

  // Criar usuário com a role a partir de um ADMIN existente
  const primeiraInst = await prisma.instituicao.findFirst({ select: { id: true } });
  const adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId: primeiraInst?.id,
      roles: { some: { role: 'ADMIN' } },
    },
    include: { roles: { select: { role: true } } },
  });

  if (!adminUser || !primeiraInst) {
    return null;
  }

  const emailTeste = `test-${role.toLowerCase()}@dsicola.test`;
  let user = await prisma.user.findFirst({
    where: { email: emailTeste },
    include: { roles: true },
  });

  if (user) {
    const temRole = user.roles.some((r) => r.role === role);
    if (!temRole) {
      await prisma.userRole_.create({
        data: { userId: user.id, role, instituicaoId: primeiraInst.id },
      });
    }
    return {
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      instituicaoId: user.instituicaoId,
    };
  }

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  user = await prisma.user.create({
    data: {
      email: emailTeste,
      password: hash,
      nomeCompleto: `Teste ${role}`,
      instituicaoId: primeiraInst.id,
      mustChangePassword: false,
    },
  });
  await prisma.userRole_.create({
    data: { userId: user.id, role, instituicaoId: primeiraInst.id },
  });

  return {
    id: user.id,
    email: user.email,
    nomeCompleto: user.nomeCompleto,
    instituicaoId: user.instituicaoId,
  };
}

async function runRoleTests(
  role: 'RH' | 'FINANCEIRO',
  user: { id: string; email: string; instituicaoId: string | null },
  instituicaoId: string
) {
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, mustChangePassword: false },
  });

  const q = (p?: Record<string, string>) => (instituicaoId ? { ...(p || {}), instituicaoId } : p || {});

  const results: TestResult[] = [];

  console.log(`\n  1. LOGIN como ${role}...`);
  const loginRes = await api.post('/auth/login', { email: user.email, password: SENHA_TESTE });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    results.push({
      name: `Login ${role}`,
      ok: false,
      message: loginRes.data?.message || 'Login falhou',
      status: loginRes.status,
    });
    return results;
  }

  const token = loginRes.data.accessToken;
  const loginUser = loginRes.data.user;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  const roles = Array.isArray(loginUser?.roles) ? loginUser.roles : [];
  results.push({
    name: `Login ${role} - JWT com role`,
    ok: roles.includes(role),
    details: `Roles: ${roles.join(', ')}`,
  });

  console.log(`     ✅ Login OK - ${loginUser?.nomeCompleto || loginUser?.email}`);

  if (role === 'RH') {
    console.log('  2. RH - Rotas permitidas (funcionários, folha)...');
    results.push(
      await runTest(api, 'GET /funcionarios', async () => {
        const r = await api.get('/funcionarios', { params: q() });
        return { status: r.status, data: r.data };
      })
    );
    results.push(
      await runTest(api, 'GET /folha-pagamento', async () => {
        const r = await api.get('/folha-pagamento', { params: q() });
        return { status: r.status, data: r.data };
      })
    );
    results.push(
      await runTest(api, 'GET /auth/profile', async () => {
        const r = await api.get('/auth/profile');
        return { status: r.status, data: r.data };
      })
    );

    console.log('  3. RH - Rotas bloqueadas (instituições - apenas ADMIN/SUPER_ADMIN/COMERCIAL)...');
    const instResRh = await api.get('/instituicoes');
    results.push({
      name: 'RH bloqueado de GET /instituicoes',
      ok: instResRh.status === 403,
      status: instResRh.status,
      details: instResRh.status === 403 ? 'Correto: 403' : `Inesperado: ${instResRh.status}`,
    });
  } else {
    console.log('  2. FINANCEIRO - Rotas permitidas (mensalidades, pagamentos, recibos)...');
    results.push(
      await runTest(api, 'GET /mensalidades', async () => {
        const r = await api.get('/mensalidades', { params: q() });
        return { status: r.status, data: r.data };
      })
    );
    results.push(
      await runTest(api, 'GET /pagamentos', async () => {
        const r = await api.get('/pagamentos', { params: q() });
        return { status: r.status, data: r.data };
      })
    );
    results.push(
      await runTest(api, 'GET /recibos', async () => {
        const r = await api.get('/recibos', { params: q() });
        return { status: r.status, data: r.data };
      })
    );
    results.push(
      await runTest(api, 'GET /auth/profile', async () => {
        const r = await api.get('/auth/profile');
        return { status: r.status, data: r.data };
      })
    );

    console.log('  3. FINANCEIRO - Rotas bloqueadas (instituições)...');
    const instResFin = await api.get('/instituicoes');
    results.push({
      name: 'FINANCEIRO bloqueado de GET /instituicoes',
      ok: instResFin.status === 403,
      status: instResFin.status,
      details: instResFin.status === 403 ? 'Correto: 403' : `Inesperado: ${instResFin.status}`,
    });
  }

  return results;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE PERFIS RH E FINANCEIRO - DSICOLA');
  console.log('  Perfis por departamento: RH → Recursos Humanos | FINANCEIRO → Pagamentos');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  try {
    const rhUser = await findOrCreateUserWithRole('RH');
    const finUser = await findOrCreateUserWithRole('FINANCEIRO');

    if (!rhUser?.instituicaoId) {
      console.error('❌ Nenhuma instituição encontrada. Execute o seed primeiro.');
      process.exit(1);
    }
    const instituicaoId = rhUser.instituicaoId;

    if (!rhUser) {
      console.error('❌ Não foi possível obter/criar usuário RH.');
      process.exit(1);
    }
    if (!finUser?.instituicaoId) {
      finUser!.instituicaoId = instituicaoId;
    }

    const allResults: TestResult[] = [];

    console.log('═'.repeat(60));
    console.log('  PERFIL RH');
    console.log('═'.repeat(60));
    const rhResults = await runRoleTests('RH', rhUser, instituicaoId);
    allResults.push(...rhResults);

    console.log('\n' + '═'.repeat(60));
    console.log('  PERFIL FINANCEIRO');
    console.log('═'.repeat(60));
    const finUserForTest = finUser || rhUser;
    const finResults = await runRoleTests('FINANCEIRO', finUserForTest, instituicaoId);
    allResults.push(...finResults);

    await prisma.$disconnect();

    // ─── RELATÓRIO ─────────────────────────────────────────────────────
    console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  RELATÓRIO - TESTES RH E FINANCEIRO                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const passed = allResults.filter((r) => r.ok).length;
    const failed = allResults.filter((r) => !r.ok);

    allResults.forEach((r) => {
      const icon = r.ok ? '✅' : '❌';
      const msg = r.details || r.message || '';
      console.log(`  ${icon} ${r.name}${msg ? ` - ${msg}` : ''}`);
    });

    console.log(`\n  Total: ${passed}/${allResults.length} testes passaram\n`);

    if (failed.length > 0) {
      console.log('  FALHAS:');
      failed.forEach((r) => console.log(`    • ${r.name}: ${r.message || r.status}`));
      process.exit(1);
    }

    console.log('  ✅ Todos os testes passaram. Perfis RH e FINANCEIRO funcionando corretamente.\n');
  } catch (err: any) {
    console.error('❌ Erro:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
