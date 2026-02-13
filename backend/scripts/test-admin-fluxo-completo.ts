#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO - Admin (SUPER_ADMIN)
 *
 * Acessa como admin e executa todos os testes de fluxo do sistema de forma detalhada.
 * Garante que cada módulo crítico esteja funcionando corretamente.
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-admin-fluxo-completo.ts
 *      ou: TEST_ADMIN_EMAIL=... TEST_ADMIN_PASS=... npx tsx scripts/test-admin-fluxo-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

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
  console.log('  TESTE FLUXO COMPLETO - ADMIN (SUPER_ADMIN) - DSICOLA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}`);
  console.log(`Admin: ${ADMIN_EMAIL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // ─── 1. LOGIN ─────────────────────────────────────────────────────────────────────────────
  console.log('1. LOGIN...');
  const loginRes = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('❌ Admin precisa trocar senha. Execute: npm run db:seed');
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

  // Verificar roles
  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  results.push({
    name: 'JWT inclui role SUPER_ADMIN ou ADMIN',
    ok: roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'),
    details: `Roles: ${roles.join(', ')}`,
  });

  // ─── 2. OBTER INSTITUIÇÃO E ADMIN (SUPER_ADMIN não acessa módulos acadêmicos) ─────────────
  let instituicaoId: string | null = null;
  let adminToken = token;
  let adminApi = api;

  const instRes = await api.get('/instituicoes');
  if (instRes.status === 200 && Array.isArray(instRes.data) && instRes.data.length > 0) {
    instituicaoId = instRes.data[0].id;
    results.push({ name: 'GET /instituicoes (lista)', ok: true, details: `${instRes.data.length} instituições` });

    // Buscar ADMIN da instituição para testar módulos acadêmicos (SUPER_ADMIN é bloqueado)
    const adminUser = await prisma.user.findFirst({
      where: {
        instituicaoId,
        roles: { some: { role: 'ADMIN', instituicaoId: instituicaoId } },
      },
      select: { id: true, email: true, nomeCompleto: true },
    });

    if (adminUser) {
      // Garantir senha conhecida para o teste
      const hash = await bcrypt.hash(ADMIN_PASS, 10);
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: hash, mustChangePassword: false },
      });

      const adminLogin = await api.post('/auth/login', {
        email: adminUser.email,
        password: ADMIN_PASS,
      });
      if (adminLogin.status === 200 && adminLogin.data?.accessToken) {
        adminToken = adminLogin.data.accessToken;
        adminApi = axios.create({
          baseURL: API_URL,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          timeout: 20000,
          validateStatus: () => true,
        });
        console.log(`   ℹ️  Usando ADMIN da instituição (${adminUser.email}) para módulos acadêmicos\n`);
      }
    }
  } else {
    results.push({ name: 'GET /instituicoes (lista)', ok: instRes.status === 200, message: 'Sem instituições' });
  }

  const q = (p?: Record<string, string>) => (instituicaoId ? { ...(p || {}), instituicaoId } : (p || {}));

  // ─── 3. AUTH & PROFILE ───────────────────────────────────────────────────────────────────
  console.log('2. AUTH & PROFILE...');
  results.push(
    await runTest(adminApi, 'GET /auth/profile', async () => {
      const r = await adminApi.get('/auth/profile');
      return { status: r.status, data: r.data };
    })
  );

  // ─── 4. MÓDULO ACADÊMICO - ESTRUTURA ─────────────────────────────────────────────────────
  console.log('3. MÓDULO ACADÊMICO (Cursos, Classes, Disciplinas)...');
  results.push(
    await runTest(adminApi, 'GET /cursos', async () => {
      const r = await adminApi.get('/cursos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /classes', async () => {
      const r = await adminApi.get('/classes', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /disciplinas', async () => {
      const r = await adminApi.get('/disciplinas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 5. ANO LETIVO & TURMAS ──────────────────────────────────────────────────────────────
  console.log('4. ANO LETIVO & TURMAS...');
  results.push(
    await runTest(adminApi, 'GET /anos-letivos', async () => {
      const r = await adminApi.get('/anos-letivos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /turmas', async () => {
      const r = await adminApi.get('/turmas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 6. PROFESSORES & PLANO DE ENSINO ────────────────────────────────────────────────────
  console.log('5. PROFESSORES & PLANO DE ENSINO...');
  results.push(
    await runTest(adminApi, 'GET /professores', async () => {
      const r = await adminApi.get('/professores', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /plano-ensino', async () => {
      const profs = await adminApi.get('/professores', { params: q() });
      const anos = await adminApi.get('/anos-letivos', { params: q() });
      const primeiroProf = Array.isArray(profs.data) ? profs.data[0] : null;
      const primeiroAno = Array.isArray(anos.data) ? anos.data[0] : null;
      const params = {
        ...q(),
        ...(primeiroProf?.id && { professorId: primeiroProf.id }),
        ...(primeiroAno?.id && { anoLetivoId: primeiroAno.id }),
      };
      const r = await adminApi.get('/plano-ensino', { params });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 7. MATRÍCULAS & ALUNOS ──────────────────────────────────────────────────────────────
  console.log('6. MATRÍCULAS & ESTUDANTES...');
  results.push(
    await runTest(adminApi, 'GET /matriculas', async () => {
      const r = await adminApi.get('/matriculas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /estudantes', async () => {
      const r = await adminApi.get('/estudantes', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 8. NOTAS & AVALIAÇÕES ──────────────────────────────────────────────────────────────
  console.log('7. NOTAS & AVALIAÇÕES...');
  results.push(
    await runTest(adminApi, 'GET /notas', async () => {
      const r = await adminApi.get('/notas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /avaliacoes', async () => {
      const r = await adminApi.get('/avaliacoes', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 9. AULAS & FREQUÊNCIAS ──────────────────────────────────────────────────────────────
  console.log('8. AULAS & FREQUÊNCIAS...');
  results.push(
    await runTest(adminApi, 'GET /aulas-planejadas', async () => {
      if (!instituicaoId) return { status: 200, data: [] };
      const profs = await adminApi.get('/professores', { params: q() });
      const anos = await adminApi.get('/anos-letivos', { params: q() });
      const planos = await adminApi.get('/plano-ensino', {
        params: {
          ...q(),
          professorId: Array.isArray(profs.data) ? profs.data[0]?.id : null,
          anoLetivoId: Array.isArray(anos.data) ? anos.data[0]?.id : null,
        },
      });
      const primeiro = Array.isArray(planos.data) ? planos.data[0] : planos.data;
      const params =
        primeiro?.disciplinaId && (primeiro?.anoLetivo ?? primeiro?.anoLetivoRef?.ano) != null && primeiro?.professorId
          ? {
              ...q(),
              disciplinaId: primeiro.disciplinaId,
              anoLetivo: String(primeiro.anoLetivo ?? primeiro.anoLetivoRef?.ano ?? ''),
              professorId: primeiro.professorId,
            }
          : q();
      const r = await adminApi.get('/aulas-planejadas', { params });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /aulas-lancadas', async () => {
      const r = await adminApi.get('/aulas-lancadas', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /frequencias', async () => {
      const r = await adminApi.get('/frequencias', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 10. RELATÓRIOS & ESTATÍSTICAS ───────────────────────────────────────────────────────
  console.log('9. RELATÓRIOS & ESTATÍSTICAS...');
  results.push(
    await runTest(api, 'GET /stats/admin', async () => {
      const r = await api.get('/stats/admin', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /estatisticas/instituicao', async () => {
      const r = await adminApi.get('/estatisticas/instituicao', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 11. CONFIGURAÇÕES & PARÂMETROS ──────────────────────────────────────────────────────
  console.log('10. CONFIGURAÇÕES...');
  results.push(
    await runTest(adminApi, 'GET /configuracoes-instituicao', async () => {
      const r = await adminApi.get('/configuracoes-instituicao', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  // PUT configuracoes - opcional: pode falhar se BD em estado específico
  results.push(
    await runTest(adminApi, 'PUT /configuracoes-instituicao', async () => {
      const r = await adminApi.put('/configuracoes-instituicao', {
        nomeInstituicao: 'Teste Config',
        idioma: 'pt',
        regimeFiscal: 'normal',
        emailFiscal: 'fiscal@teste.ao',
        pais: 'Angola',
        moedaPadrao: 'AOA',
      });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /parametros-sistema', async () => {
      const r = await adminApi.get('/parametros-sistema', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 12. USUÁRIOS & ROLES ───────────────────────────────────────────────────────────────
  console.log('11. USUÁRIOS & ROLES...');
  results.push(
    await runTest(api, 'GET /users', async () => {
      const r = await api.get('/users', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 13. FINANCEIRO (mensalidades, pagamentos) ───────────────────────────────────────────
  console.log('12. MÓDULO FINANCEIRO...');
  results.push(
    await runTest(adminApi, 'GET /mensalidades', async () => {
      const r = await adminApi.get('/mensalidades', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /pagamentos', async () => {
      const r = await adminApi.get('/pagamentos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 14. COMUNICADOS & TURNOS ───────────────────────────────────────────────────────────
  console.log('13. COMUNICADOS & TURNOS...');
  results.push(
    await runTest(adminApi, 'GET /comunicados', async () => {
      const r = await adminApi.get('/comunicados', { params: q() });
      return { status: r.status, data: r.data };
    })
  );
  results.push(
    await runTest(adminApi, 'GET /turnos', async () => {
      const r = await adminApi.get('/turnos', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  // ─── 15. SAÚDE & UTILITÁRIOS ────────────────────────────────────────────────────────────
  console.log('14. SAÚDE & UTILITÁRIOS...');
  results.push(
    await runTest(api, 'GET /health', async () => {
      const r = await api.get('/health');
      return { status: r.status, data: r.data };
    })
  );

  await prisma.$disconnect();

  // ─── RELATÓRIO FINAL ────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESULTADOS - TESTE FLUXO COMPLETO ADMIN');
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

  console.log('\n✅ Todos os testes do fluxo ADMIN passaram! Sistema funcionando corretamente.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
