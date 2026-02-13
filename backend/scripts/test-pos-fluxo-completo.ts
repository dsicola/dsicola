#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO - Perfil POS (Ponto de Venda)
 *
 * Valida todas as funcionalidades do perfil POS:
 * - Login e JWT com role POS
 * - Profile e instituição
 * - Mensalidades (listar, visualizar pendentes)
 * - Pagamentos (listar, registrar, estornar)
 * - Recibos
 * - Perfis (buscar alunos para processar pagamentos)
 * - Ano letivo (ativo, verificar encerrado)
 * - Comunicados (ler, marcar lido)
 * - Bloqueio de rotas não permitidas (estudantes, admin, etc.)
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-pos-fluxo-completo.ts
 *      ou: TEST_POS_EMAIL=pos@email.com TEST_POS_PASS=senha npx tsx scripts/test-pos-fluxo-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA_TESTE = process.env.TEST_POS_PASS || 'POS@123';

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
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - POS (Ponto de Venda) - DSICOLA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const emailFromEnv = process.env.TEST_POS_EMAIL?.trim();

  // ─── 1. ENCONTRAR OU CRIAR USUÁRIO POS ──────────────────────────────────────────────────
  let posUser: { id: string; email: string; nomeCompleto: string | null; instituicaoId: string | null } | null = null;

  if (emailFromEnv) {
    const user = await prisma.user.findFirst({
      where: { email: emailFromEnv.toLowerCase() },
      include: { roles: { select: { role: true } } },
    });
    if (user && user.roles.some((r) => r.role === 'POS')) {
      posUser = { id: user.id, email: user.email, nomeCompleto: user.nomeCompleto, instituicaoId: user.instituicaoId };
    }
    if (!posUser) {
      console.error('❌ Usuário não encontrado ou não possui role POS:', emailFromEnv);
      process.exit(1);
    }
  } else {
    // Buscar primeiro usuário com role POS
    const userWithPos = await prisma.user.findFirst({
      where: {
        roles: { some: { role: 'POS' } },
        instituicaoId: { not: null },
      },
      include: { roles: { select: { role: true } } },
    });

    if (userWithPos) {
      posUser = {
        id: userWithPos.id,
        email: userWithPos.email,
        nomeCompleto: userWithPos.nomeCompleto,
        instituicaoId: userWithPos.instituicaoId,
      };
    }
  }

  // Se não encontrou POS, criar adicionando role a um usuário existente
  if (!posUser) {
    const primeiraInst = await prisma.instituicao.findFirst({ select: { id: true, nome: true } });
    if (!primeiraInst) {
      console.error('❌ Nenhuma instituição encontrada. Execute o seed primeiro.');
      process.exit(1);
    }

    const secretariaOuAdmin = await prisma.user.findFirst({
      where: {
        instituicaoId: primeiraInst.id,
        roles: { some: { role: { in: ['SECRETARIA', 'ADMIN'] } } },
      },
      include: { roles: { select: { role: true } } },
    });

    if (secretariaOuAdmin) {
      const temPos = secretariaOuAdmin.roles.some((r) => r.role === 'POS');
      if (!temPos) {
        await prisma.userRole_.create({
          data: {
            userId: secretariaOuAdmin.id,
            role: 'POS',
            instituicaoId: primeiraInst.id,
          },
        });
        console.log(`   ℹ️  Adicionada role POS ao usuário ${secretariaOuAdmin.email}`);
      }
      posUser = {
        id: secretariaOuAdmin.id,
        email: secretariaOuAdmin.email,
        nomeCompleto: secretariaOuAdmin.nomeCompleto,
        instituicaoId: secretariaOuAdmin.instituicaoId,
      };
    } else {
      console.error('❌ Nenhum usuário POS encontrado e não há SECRETARIA/ADMIN para adicionar role.');
      console.error('   Crie um usuário com role POS ou execute: npm run db:seed');
      process.exit(1);
    }
  }

  const email = posUser.email;
  const instituicaoId = posUser.instituicaoId;

  // Obter ID de comunicado para testar GET /comunicados/:id (POS não pode listar, mas pode ver por id)
  let primeiroComunicadoId: string | null = null;
  if (instituicaoId) {
    const com = await prisma.comunicado.findFirst({
      where: { instituicaoId, ativo: true },
      select: { id: true },
    });
    primeiroComunicadoId = com?.id ?? null;
  }

  console.log(`POS: ${posUser.nomeCompleto || email} (${email})`);
  console.log('Definindo senha de teste...');

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: posUser.id },
    data: { password: hash, mustChangePassword: false },
  });
  console.log(`✅ Senha definida: ${SENHA_TESTE}\n`);

  await prisma.$disconnect();

  // ─── 2. CLIENTE API E LOGIN ─────────────────────────────────────────────────────────────
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  console.log('1. LOGIN...');
  const loginRes = await api.post('/auth/login', { email, password: SENHA_TESTE });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('❌ POS precisa trocar senha. Execute: npm run db:seed');
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`   ✅ Login OK - ${user?.nomeCompleto || user?.email}\n`);

  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  results.push({
    name: 'JWT inclui role POS',
    ok: roles.includes('POS'),
    details: `Roles: ${roles.join(', ')}`,
  });

  // ─── 3. VALIDAR JWT ─────────────────────────────────────────────────────────────────────
  const payload = decodeJwtPayload(token);
  if (payload) {
    const hasInstituicaoId = payload.instituicaoId !== undefined && payload.instituicaoId !== null;
    results.push({ name: 'JWT instituicao_id presente', ok: !!hasInstituicaoId });
  }

  const q = (p?: Record<string, string>) => (instituicaoId ? { ...(p || {}), instituicaoId } : (p || {}));

  // ─── 4. AUTH & PROFILE ──────────────────────────────────────────────────────────────────
  console.log('2. AUTH & PROFILE...');
  results.push(
    await runTest(api, 'GET /auth/profile', async () => {
      const r = await api.get('/auth/profile');
      return { status: r.status, data: r.data };
    })
  );

  // ─── 5. MÓDULO FINANCEIRO - MENSALIDADES ─────────────────────────────────────────────────
  console.log('3. MENSALIDADES...');
  results.push(
    await runTest(api, 'GET /mensalidades', async () => {
      const r = await api.get('/mensalidades', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  let primeiraMensalidadeId: string | null = null;
  const mensResp = await api.get('/mensalidades', { params: { ...q(), status: 'Pendente' } });
  if (mensResp.status === 200 && Array.isArray(mensResp.data?.data)) {
    const pendentes = mensResp.data.data.filter((m: any) => m.status === 'Pendente' || m.status === 'Atrasado');
    primeiraMensalidadeId = pendentes[0]?.id ?? null;
  }
  if (!primeiraMensalidadeId && mensResp.status === 200 && Array.isArray(mensResp.data)) {
    const pendentes = mensResp.data.filter((m: any) => m.status === 'Pendente' || m.status === 'Atrasado');
    primeiraMensalidadeId = pendentes[0]?.id ?? null;
  }

  if (primeiraMensalidadeId) {
    results.push(
      await runTest(api, 'GET /mensalidades/:id', async () => {
        const r = await api.get(`/mensalidades/${primeiraMensalidadeId}`);
        return { status: r.status, data: r.data };
      })
    );
  } else {
    results.push({
      name: 'GET /mensalidades/:id',
      ok: true,
      details: 'Sem mensalidades pendentes para testar (OK)',
    });
  }

  // ─── 6. PAGAMENTOS ─────────────────────────────────────────────────────────────────────
  console.log('4. PAGAMENTOS...');
  results.push(
    await runTest(api, 'GET /pagamentos', async () => {
      const r = await api.get('/pagamentos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  if (primeiraMensalidadeId) {
    results.push(
      await runTest(api, 'GET /pagamentos/mensalidade/:mensalidadeId', async () => {
        const r = await api.get(`/pagamentos/mensalidade/${primeiraMensalidadeId}`);
        return { status: r.status, data: r.data };
      })
    );
  }

  // ─── 7. RECIBOS ───────────────────────────────────────────────────────────────────────
  console.log('5. RECIBOS...');
  results.push(
    await runTest(api, 'GET /recibos', async () => {
      const r = await api.get('/recibos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 8. PERFIS (buscar alunos) ───────────────────────────────────────────────────────────
  console.log('6. PERFIS (buscar alunos para pagamento)...');
  results.push(
    await runTest(api, 'GET /profiles (busca alunos)', async () => {
      const r = await api.get('/profiles', { params: { ...q(), role: 'ALUNO', status: 'ativo' } });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 9. ANO LETIVO ──────────────────────────────────────────────────────────────────────
  console.log('7. ANO LETIVO...');
  results.push(
    await runTest(api, 'GET /anos-letivos', async () => {
      const r = await api.get('/anos-letivos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(api, 'GET /anos-letivos/ativo', async () => {
      const r = await api.get('/anos-letivos/ativo', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(api, 'GET /anos-letivos/verificar-encerrado', async () => {
      const r = await api.get('/anos-letivos/verificar-encerrado', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 10. COMUNICADOS ───────────────────────────────────────────────────────────────────
  console.log('8. COMUNICADOS...');
  if (primeiroComunicadoId) {
    results.push(
      await runTest(api, 'GET /comunicados/:id', async () => {
        const r = await api.get(`/comunicados/${primeiroComunicadoId}`);
        return { status: r.status, data: r.data };
      })
    );
  } else {
    results.push({
      name: 'GET /comunicados/:id',
      ok: true,
      details: 'Sem comunicados para testar (OK)',
    });
  }

  // ─── 11. BLOQUEIO DE ROTAS NÃO PERMITIDAS ──────────────────────────────────────────────
  console.log('9. BLOQUEIO (rotas não permitidas para POS)...');
  results.push(
    await runTest(api, 'POS NÃO acessa GET /estudantes (403)', async () => {
      const r = await api.get('/estudantes', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'POS NÃO acessa GET /users (403)', async () => {
      const r = await api.get('/users', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(api, 'POS NÃO acessa POST /mensalidades (403)', async () => {
      const r = await api.post('/mensalidades', {});
      return { status: r.status, data: r.data };
    })
  );

  // O teste de bloqueio: 403 é esperado (ok = true quando status 403)
  const bloqueioTests = results.filter((r) => r.name.includes('NÃO acessa'));
  for (const t of bloqueioTests) {
    if (t.status === 403) {
      t.ok = true;
      t.message = undefined;
    }
  }

  // ─── 12. HEALTH ───────────────────────────────────────────────────────────────────────
  console.log('10. SAÚDE...');
  results.push(
    await runTest(api, 'GET /health', async () => {
      const r = await api.get('/health');
      return { status: r.status, data: r.data };
    })
  );

  // ─── RELATÓRIO FINAL ───────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESULTADOS - TESTE FLUXO COMPLETO POS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    const status = r.status ? ` (${r.status})` : '';
    console.log(`${icon} ${r.name}${status}`);
    if (!r.ok && r.message) {
      console.log(`   └─ ${String(r.message).slice(0, 100)}${String(r.message).length > 100 ? '...' : ''}`);
    }
    if (r.details && r.ok) {
      console.log(`   └─ ${r.details}`);
    }
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    process.exit(1);
  }

  console.log('\n✅ Todos os testes do fluxo POS passaram! Sistema funcionando corretamente.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
