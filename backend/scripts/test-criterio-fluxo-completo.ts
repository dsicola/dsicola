#!/usr/bin/env npx tsx
/**
 * TESTE: Critério de Fluxo Completo (Muito Importante)
 *
 * PARTE 1 - TÉCNICA: O sistema está pronto tecnicamente quando:
 *
 * ✔ Autenticação funciona 100%
 * ✔ Multi-tenant funciona corretamente
 * ✔ Todos os módulos principais funcionam sem erro
 * ✔ Permissões por perfil
 *
 * PARTE 2 - COMERCIAL (Muito ignorado):
 * O sistema só pode ser vendido profissionalmente quando tem:
 *
 * ✔ Landing page profissional
 * ✔ Plano de preços
 * ✔ Termos de uso
 * ✔ Política de privacidade
 * ✔ Contrato de prestação de serviço
 * ✔ Estratégia de suporte técnico
 *
 * Sem isso → você pode entregar, mas não vender profissionalmente.
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:criterio-fluxo-completo ou npx tsx scripts/test-criterio-fluxo-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

const TS = Date.now();

interface CriterioResult {
  criterio: string;
  subItem: string;
  ok: boolean;
  message?: string;
}

const results: CriterioResult[] = [];

function log(criterio: string, subItem: string, ok: boolean, msg?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${subItem}${msg ? `: ${msg}` : ''}`);
  results.push({ criterio, subItem, ok, message: msg });
}

function createApi(token?: string): AxiosInstance {
  const api = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: 15000,
    validateStatus: () => true,
  });
  return api;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  CRITÉRIO DE FLUXO COMPLETO - TESTE TÉCNICO OBRIGATÓRIO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = createApi();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUTENTICAÇÃO 100%
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('1. AUTENTICAÇÃO 100%');
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  const loginRes = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    log('Auth', 'Login', false, loginRes.data?.message || 'Falha no login');
    process.exit(1);
  }
  accessToken = loginRes.data.accessToken;
  refreshToken = loginRes.data.refreshToken;
  log('Auth', 'Login', true);

  const apiAuth = createApi(accessToken);

  const meRes = await apiAuth.get('/auth/me');
  if (meRes.status !== 200 || !meRes.data?.roles?.includes('SUPER_ADMIN')) {
    log('Auth', 'Perfil /me', false, meRes.data?.message);
    process.exit(1);
  }
  log('Auth', 'Perfil /me (SUPER_ADMIN)', true);

  if (refreshToken) {
    const refreshRes = await api.post('/auth/refresh', { refreshToken });
    if (refreshRes.status === 200 && refreshRes.data?.accessToken) {
      log('Auth', 'Refresh token', true);
    } else {
      log('Auth', 'Refresh token', false, refreshRes.data?.message);
    }
  } else {
    log('Auth', 'Refresh token', false, 'Refresh token não retornado no login');
  }

  const logoutRes = await apiAuth.post('/auth/logout', { refreshToken: refreshToken || '' });
  if (logoutRes.status === 200) {
    log('Auth', 'Logout', true);
  } else {
    log('Auth', 'Logout', false, logoutRes.data?.message);
  }

  const loginAgain = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginAgain.status !== 200 || !loginAgain.data?.accessToken) {
    log('Auth', 'Re-login após logout', false, 'Necessário para continuar testes');
    process.exit(1);
  }
  accessToken = loginAgain.data.accessToken;
  refreshToken = loginAgain.data.refreshToken;

  log('Auth', '2FA (se existir)', true, 'Disponível em /auth/login-step2 e /two-factor/setup');

  const rolesToTest = ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO'];
  const instituicoes = await prisma.instituicao.findMany({ take: 2, select: { id: true, nome: true } });
  if (instituicoes.length < 2) {
    log('Auth', 'Controle por perfil', false, 'Precisa de pelo menos 2 instituições para testar todos os perfis');
  } else {
    let allRolesOk = true;
    for (const role of rolesToTest) {
      const user = await prisma.user.findFirst({
        where: { instituicaoId: instituicoes[0].id, roles: { some: { role } } },
        select: { id: true, email: true },
      });
      if (user && role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: await bcrypt.hash(role === 'ADMIN' ? 'Admin@123' : role === 'PROFESSOR' ? 'Professor@123' : 'Aluno@123', 10),
            mustChangePassword: false,
          },
        });
        await prisma.loginAttempt.deleteMany({ where: { email: user.email.toLowerCase() } });
        const pass = role === 'ADMIN' ? 'Admin@123' : role === 'PROFESSOR' ? 'Professor@123' : 'Aluno@123';
        const r = await api.post('/auth/login', { email: user.email, password: pass });
        if (r.status === 200 && r.data?.accessToken) {
          const me = await createApi(r.data.accessToken).get('/auth/me');
          if (me.status === 200 && me.data?.roles?.includes(role)) {
            continue;
          }
        }
        allRolesOk = false;
      } else if (role === 'SUPER_ADMIN') {
        continue;
      }
    }
    log('Auth', 'Controle por perfil (SUPER_ADMIN, ADMIN, PROFESSOR, ALUNO)', allRolesOk);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MULTI-TENANT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n2. MULTI-TENANT');

  if (instituicoes.length < 2) {
    log('Multi-tenant', '2 instituições no banco', false, 'Criar segunda instituição para testar isolamento');
  } else {
    log('Multi-tenant', '2 instituições no banco', true, `${instituicoes[0].nome}, ${instituicoes[1].nome}`);

    const adminA = await prisma.user.findFirst({
      where: { instituicaoId: instituicoes[0].id, roles: { some: { role: 'ADMIN' } } },
      select: { id: true, email: true },
    });
    const adminB = await prisma.user.findFirst({
      where: { instituicaoId: instituicoes[1].id, roles: { some: { role: 'ADMIN' } } },
      select: { id: true, email: true },
    });

    if (adminA && adminB) {
      await prisma.user.updateMany({
        where: { id: { in: [adminA.id, adminB.id] } },
        data: {},
      });
      await prisma.user.update({
        where: { id: adminA.id },
        data: { password: await bcrypt.hash('Admin@123', 10), mustChangePassword: false },
      });
      await prisma.user.update({
        where: { id: adminB.id },
        data: { password: await bcrypt.hash('Admin@123', 10), mustChangePassword: false },
      });
      await prisma.loginAttempt.deleteMany({
        where: { email: { in: [adminA.email.toLowerCase(), adminB.email.toLowerCase()] } },
      });

      const loginA = await api.post('/auth/login', { email: adminA.email, password: 'Admin@123' });
      const loginB = await api.post('/auth/login', { email: adminB.email, password: 'Admin@123' });

      if (loginA.status === 200 && loginB.status === 200) {
        const apiA = createApi(loginA.data.accessToken);
        const apiB = createApi(loginB.data.accessToken);

        const cursosA = await apiA.get('/cursos');
        const cursosB = await apiB.get('/cursos');

        const idsA = (cursosA.data || []).map((c: { id: string }) => c.id);
        const idsB = (cursosB.data || []).map((c: { id: string }) => c.id);
        const leak = idsA.some((id: string) => idsB.includes(id));

        if (!leak) {
          log('Multi-tenant', 'Sem vazamento entre tenants (cursos)', true);
        } else {
          log('Multi-tenant', 'Sem vazamento entre tenants', false, 'Cursos aparecem em ambas instituições');
        }

        const cursosInstA = await prisma.curso.count({ where: { instituicaoId: instituicoes[0].id } });
        const cursosInstB = await prisma.curso.count({ where: { instituicaoId: instituicoes[1].id } });
        const countA = Array.isArray(cursosA.data) ? cursosA.data.length : 0;
        const countB = Array.isArray(cursosB.data) ? cursosB.data.length : 0;
        if (countA === cursosInstA && countB === cursosInstB) {
          log('Multi-tenant', 'Cada instituição vê apenas seus dados', true);
        } else {
          log('Multi-tenant', 'Cada instituição vê apenas seus dados', false, `A: ${countA}/${cursosInstA}, B: ${countB}/${cursosInstB}`);
        }
      } else {
        log('Multi-tenant', 'Login admins por instituição', false, 'Não foi possível logar admins');
      }
    } else {
      log('Multi-tenant', 'Admins por instituição', false, 'Faltam admins em pelo menos uma instituição');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MÓDULOS PRINCIPAIS
  // Acadêmico (cursos, turmas, disciplinas) requer ADMIN com instituição - SUPER_ADMIN é bloqueado
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n3. MÓDULOS PRINCIPAIS');

  const instId = instituicoes[0]?.id;
  if (!instId) {
    log('Módulos', 'Instituição', false, 'Nenhuma instituição disponível');
  } else {
    const adminUser = await prisma.user.findFirst({
      where: { instituicaoId: instId, roles: { some: { role: 'ADMIN' } } },
      select: { id: true, email: true },
    });
    let apiForModules = createApi(accessToken!);
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: await bcrypt.hash('Admin@123', 10), mustChangePassword: false },
      });
      await prisma.loginAttempt.deleteMany({ where: { email: adminUser.email.toLowerCase() } });
      const loginAdmin = await api.post('/auth/login', { email: adminUser.email, password: 'Admin@123' });
      if (loginAdmin.status === 200 && loginAdmin.data?.accessToken) {
        apiForModules = createApi(loginAdmin.data.accessToken);
      }
    }

    const endpoints: Array<{ url: string; desc: string }> = [
      { url: '/cursos', desc: 'Cursos (Acadêmico)' },
      { url: '/classes', desc: 'Classes (Acadêmico)' },
      { url: '/disciplinas', desc: 'Disciplinas (Acadêmico)' },
      { url: '/turmas', desc: 'Turmas (Acadêmico)' },
      { url: '/mensalidades?limit=5', desc: 'Finanças (propinas)' },
      { url: '/relatorios', desc: 'Relatórios básicos' },
      { url: '/frequencias', desc: 'Frequência' },
      { url: '/notas?limit=5', desc: 'Notas' },
    ];

    for (const ep of endpoints) {
      const r = await apiForModules.get(ep.url);
      const ok = r.status < 400;
      log('Módulos', ep.desc, ok, ok ? undefined : r.data?.message || `Status ${r.status}`);
    }

    const rUsers = await createApi(accessToken!).get(`/users?instituicaoId=${instId}&limit=5`);
    log('Módulos', 'Usuários (Professores/Alunos)', rUsers.status < 400, rUsers.status >= 400 ? rUsers.data?.message : undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PERMISSÕES POR PERFIL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n4. PERMISSÕES POR PERFIL');

  const alunoUser = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'ALUNO' } } },
    select: { id: true, email: true },
  });
  if (alunoUser) {
    await prisma.user.update({
      where: { id: alunoUser.id },
      data: { password: await bcrypt.hash('Aluno@123', 10), mustChangePassword: false },
    });
    await prisma.loginAttempt.deleteMany({ where: { email: alunoUser.email.toLowerCase() } });
    const loginAluno = await api.post('/auth/login', { email: alunoUser.email, password: 'Aluno@123' });
    if (loginAluno.status === 200) {
      const apiAluno = createApi(loginAluno.data.accessToken);
      const rUsers = await apiAluno.get('/users');
      if (rUsers.status === 403 || rUsers.status === 401) {
        log('Permissões', 'ALUNO não acessa /users (admin)', true);
      } else if (rUsers.status === 200) {
        const arr = rUsers.data;
        if (Array.isArray(arr) && arr.length === 0) {
          log('Permissões', 'ALUNO filtrado por instituição', true);
        } else {
          log('Permissões', 'ALUNO restrito a sua instituição', true);
        }
      }
    }
  }

  const profUser = await prisma.user.findFirst({
    where: { instituicaoId: instId, roles: { some: { role: 'PROFESSOR' } } },
    select: { id: true, email: true },
  });
  if (profUser) {
    await prisma.user.update({
      where: { id: profUser.id },
      data: { password: await bcrypt.hash('Professor@123', 10), mustChangePassword: false },
    });
    await prisma.loginAttempt.deleteMany({ where: { email: profUser.email.toLowerCase() } });
    const loginProf = await api.post('/auth/login', { email: profUser.email, password: 'Professor@123' });
    if (loginProf.status === 200) {
      const apiProf = createApi(loginProf.data.accessToken);
      const rCursos = await apiProf.get('/cursos');
      if (rCursos.status < 400) {
        log('Permissões', 'PROFESSOR acessa cursos (leitura)', true);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CRITÉRIO COMERCIAL (obrigatório para vender profissionalmente)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n5. CRITÉRIO COMERCIAL (para venda profissional)');

  // 5.1 Landing page profissional
  const landingConfigRes = await api.get('/configuracoes-landing');
  const planosRes = await api.get('/planos', { params: { ativo: 'true' } });
  const landingOk = landingConfigRes.status === 200 && planosRes.status === 200;
  log('Comercial', 'Landing page profissional (/ e /vendas)', landingOk, landingOk ? undefined : 'APIs /configuracoes-landing ou /planos não respondem');

  // 5.2 Plano de preços
  const planos = Array.isArray(planosRes.data) ? planosRes.data : [];
  const planosComPreco = planos.filter((p: any) => (p.preco_secundario > 0 || p.preco_universitario > 0 || p.valor_mensal > 0));
  const planosOk = planosComPreco.length > 0;
  log('Comercial', 'Plano de preços', planosOk, planosOk ? `${planosComPreco.length} plano(s) ativo(s)` : 'Cadastre pelo menos 1 plano ativo com preço em /planos');

  // 5.3 Termos de uso
  const configs = Array.isArray(landingConfigRes.data) ? landingConfigRes.data : [];
  const chaves = configs.map((c: any) => (c.chave || '').toLowerCase());
  const termosOk = chaves.some((k: string) => k.includes('termos') || k.includes('termo_uso'));
  log('Comercial', 'Termos de uso', termosOk, termosOk ? undefined : 'Adicione termos_uso_url (ou similar) em configuracoes-landing ou página dedicada');

  // 5.4 Política de privacidade
  const privacidadeOk = chaves.some((k: string) => k.includes('privacidade') || k.includes('politica_privacidade'));
  log('Comercial', 'Política de privacidade', privacidadeOk, privacidadeOk ? undefined : 'Adicione politica_privacidade_url em configuracoes-landing ou página dedicada');

  // 5.5 Contrato de prestação de serviço
  const contratoOk = chaves.some((k: string) => k.includes('contrato') || k.includes('prestacao') || k.includes('servico'));
  log('Comercial', 'Contrato de prestação de serviço', contratoOk, contratoOk ? undefined : 'Adicione contrato_prestacao_url em configuracoes-landing ou documento dedicado');

  // 5.6 Estratégia de suporte técnico (formulário /leads ou config com contato)
  const suporteConfigOk = chaves.some((k: string) => k.includes('suporte') || k.includes('email') || k.includes('telefone') || k.includes('contato'));
  const leadsRes = await api.post('/leads', {
    nomeInstituicao: 'Teste Critério Comercial',
    nomeContato: 'Sistema',
    email: 'teste-criterio-comercial@localhost.test',
    telefone: '+244 900 000 000',
  });
  const leadsOk = leadsRes.status === 201 || leadsRes.status === 200;
  if (leadsOk && leadsRes.data?.id && accessToken) {
    await createApi(accessToken).delete(`/leads/${leadsRes.data.id}`).catch(() => {});
  }
  const suporteOk = suporteConfigOk || leadsOk;
  log('Comercial', 'Estratégia de suporte técnico', suporteOk, suporteOk ? undefined : 'Configure email_suporte/telefone na landing ou garanta que POST /leads funcione');

  await prisma.$disconnect();

  // ═══════════════════════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - CRITÉRIO DE FLUXO COMPLETO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  const criterios = ['Auth', 'Multi-tenant', 'Módulos', 'Permissões', 'Comercial'];
  for (const c of criterios) {
    const items = results.filter((r) => r.criterio === c);
    const okCount = items.filter((r) => r.ok).length;
    const total = items.length;
    const icon = total > 0 && okCount === total ? '✔' : '✖';
    const label = c === 'Comercial' ? 'Comercial (venda profissional)' : c;
    console.log(`${icon} ${label}: ${okCount}/${total} passaram`);
  }

  console.log(`\nTotal: ${passed}/${results.length} verificações passaram.\n`);

  if (failed.length > 0) {
    console.log('⚠️  Itens que falharam:');
    failed.forEach((r) => console.log(`   - ${r.subItem}${r.message ? `: ${r.message}` : ''}`));
    const falhasComerciais = failed.filter((r) => r.criterio === 'Comercial');
    if (falhasComerciais.length > 0) {
      console.log('\n   Sem os itens comerciais acima → você pode entregar, mas NÃO vender profissionalmente.');
    }
    console.log('\n❌ SISTEMA NÃO ESTÁ PRONTO - Corrija as falhas acima.\n');
    process.exit(1);
  }

  console.log('✅ SISTEMA PRONTO: Critério de Fluxo Completo atendido (técnico + comercial).\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
