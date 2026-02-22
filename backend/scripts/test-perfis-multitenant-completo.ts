#!/usr/bin/env npx tsx
/**
 * TESTE COMPLETO - TODOS OS PERFIS + MULTI-TENANT + TIPOS DE INSTITUIÇÃO
 *
 * Valida que cada perfil (ADMIN, SECRETARIA, RH, FINANCEIRO, POS, PROFESSOR, ALUNO)
 * tem acesso correto às rotas permitidas e é bloqueado das não permitidas.
 * Garante isolamento multi-tenant e funcionamento em SECUNDARIO e SUPERIOR.
 *
 * Requer: Backend em http://localhost:3001
 * Seed: npm run seed:multi-tenant && npx tsx scripts/seed-perfis-completos.ts
 * Uso: npm run test:perfis-multitenant
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_PASSWORD || 'TestMultiTenant123!';

interface PerfilCred {
  email: string;
  role: string;
  instituicaoLabel: string;
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR';
}

const PERFIS: PerfilCred[] = [
  { email: 'admin.inst.a@teste.dsicola.com', role: 'ADMIN', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'secretaria.inst.a@teste.dsicola.com', role: 'SECRETARIA', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'rh.inst.a@teste.dsicola.com', role: 'RH', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'financeiro.inst.a@teste.dsicola.com', role: 'FINANCEIRO', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'pos.inst.a@teste.dsicola.com', role: 'POS', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'prof.inst.a@teste.dsicola.com', role: 'PROFESSOR', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'aluno.inst.a@teste.dsicola.com', role: 'ALUNO', instituicaoLabel: 'Inst A', tipoAcademico: 'SECUNDARIO' },
  { email: 'admin.inst.b@teste.dsicola.com', role: 'ADMIN', instituicaoLabel: 'Inst B', tipoAcademico: 'SUPERIOR' },
];

interface TestCase {
  name: string;
  path: string;
  method?: 'get' | 'post';
  expectStatus: number | number[]; // 2xx = sucesso, 403 = bloqueado esperado
  rolesPermitidos: string[];
}

function expectOk(status: number): boolean {
  return status >= 200 && status < 300;
}

async function runReq(
  api: AxiosInstance,
  path: string,
  method: 'get' | 'post' = 'get'
): Promise<{ status: number; data?: any }> {
  try {
    const fn = method === 'post' ? api.post : api.get;
    const r = await fn(path, method === 'post' ? {} : undefined);
    return { status: r.status, data: r.data };
  } catch (err: any) {
    return {
      status: err.response?.status ?? 0,
      data: err.response?.data,
    };
  }
}

const ROTAS_POR_ROLE: Record<string, { permitidas: string[]; bloqueadas: string[] }> = {
  ADMIN: {
    permitidas: ['/funcionarios', '/rh/estrutura-organizacional', '/mensalidades', '/stats/admin', '/cursos', '/profiles'],
    bloqueadas: [],
  },
  SECRETARIA: {
    permitidas: ['/funcionarios', '/rh/estrutura-organizacional', '/mensalidades', '/profiles', '/matriculas-anuais'],
    bloqueadas: ['/instituicoes'],
  },
  RH: {
    permitidas: ['/funcionarios', '/rh/estrutura-organizacional', '/folha-pagamento', '/auth/profile'],
    bloqueadas: ['/instituicoes', '/users'],
  },
  FINANCEIRO: {
    permitidas: ['/mensalidades', '/pagamentos', '/recibos', '/auth/profile'],
    bloqueadas: ['/instituicoes', '/funcionarios'],
  },
  POS: {
    permitidas: ['/mensalidades', '/pagamentos', '/recibos', '/auth/profile', '/profiles'],
    bloqueadas: ['/instituicoes', '/funcionarios'],
  },
  PROFESSOR: {
    permitidas: ['/turmas/professor', '/auth/profile', '/plano-ensino'],
    bloqueadas: ['/instituicoes', '/funcionarios', '/mensalidades'],
  },
  ALUNO: {
    permitidas: ['/matriculas-anuais/meus-anos-letivos', '/auth/profile', '/mensalidades/aluno'],
    bloqueadas: ['/instituicoes', '/funcionarios', '/users'],
  },
};

async function testarPerfil(perfil: PerfilCred): Promise<{ ok: number; fail: number; details: string[] }> {
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    validateStatus: () => true,
  });

  const details: string[] = [];
  let ok = 0;
  let fail = 0;

  const loginRes = await api.post('/auth/login', { email: perfil.email, password: SENHA });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    details.push(`❌ Login falhou: ${loginRes.status} - ${loginRes.data?.message || 'sem token'}`);
    return { ok: 0, fail: 1, details };
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;
  const user = loginRes.data.user;
  const instituicaoId = user?.instituicaoId ?? user?.instituicao_id;

  if (!instituicaoId && perfil.role !== 'SUPER_ADMIN') {
    details.push(`⚠ Token sem instituicaoId - pode falhar em rotas multi-tenant`);
  }

  const config = ROTAS_POR_ROLE[perfil.role];
  if (!config) {
    details.push(`⚠ Sem config de rotas para ${perfil.role}`);
    return { ok, fail, details };
  }

  for (const path of config.permitidas) {
    const { status } = await runReq(api, path);
    if (expectOk(status)) {
      ok++;
      details.push(`  ✅ ${path} → ${status}`);
    } else {
      fail++;
      details.push(`  ❌ ${path} → ${status} (esperado 2xx)`);
    }
  }

  for (const path of config.bloqueadas) {
    const { status } = await runReq(api, path);
    if (status === 403) {
      ok++;
      details.push(`  ✅ ${path} → 403 (bloqueado corretamente)`);
    } else {
      fail++;
      details.push(`  ❌ ${path} → ${status} (esperado 403)`);
    }
  }

  return { ok, fail, details };
}

async function testarMultiTenant(): Promise<{ ok: number; fail: number; details: string[] }> {
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    validateStatus: () => true,
  });

  const details: string[] = [];
  let ok = 0;
  let fail = 0;

  const loginA = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  if (loginA.status !== 200) {
    details.push(`❌ Login Admin A falhou`);
    return { ok: 0, fail: 1, details };
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginA.data.accessToken}`;
  const funcs = await api.get('/funcionarios');
  const funcionarios = Array.isArray(funcs.data) ? funcs.data : funcs.data?.data ?? [];

  const instBId = await (async () => {
    const loginB = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin.inst.b@teste.dsicola.com',
      password: SENHA,
    });
    return loginB.data?.user?.instituicaoId ?? loginB.data?.user?.instituicao_id;
  })();

  const temDeOutraInst = funcionarios.some(
    (f: any) => (f.instituicaoId || f.instituicao_id) === instBId
  );
  if (!temDeOutraInst) {
    ok++;
    details.push(`  ✅ Admin Inst A não vê funcionários da Inst B (isolamento OK)`);
  } else {
    fail++;
    details.push(`  ❌ Admin Inst A viu dados da Inst B - falha multi-tenant`);
  }

  return { ok, fail, details };
}

async function testarTipoAcademico(): Promise<{ ok: number; fail: number; details: string[] }> {
  const details: string[] = [];
  let ok = 0;
  let fail = 0;

  for (const { email, tipoAcademico } of [
    { email: 'admin.inst.a@teste.dsicola.com', tipoAcademico: 'SECUNDARIO' },
    { email: 'admin.inst.b@teste.dsicola.com', tipoAcademico: 'SUPERIOR' },
  ]) {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email,
      password: SENHA,
    });
    if (loginRes.status !== 200) continue;

    const token = loginRes.data.accessToken;
    const user = loginRes.data.user;
    const tokenTipo = user?.tipoAcademico;

    if (tokenTipo === tipoAcademico) {
      ok++;
      details.push(`  ✅ ${email} → tipoAcademico=${tokenTipo} no JWT`);
    } else {
      fail++;
      details.push(`  ❌ ${email} esperado ${tipoAcademico}, obteve ${tokenTipo}`);
    }
  }

  return { ok, fail, details };
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE COMPLETO - PERFIS + MULTI-TENANT + TIPOS DE INSTITUIÇÃO         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`API: ${API_URL}`);
  console.log('');

  let totalOk = 0;
  let totalFail = 0;

  for (const perfil of PERFIS) {
    console.log('─'.repeat(70));
    console.log(`  ${perfil.role} (${perfil.email}) - ${perfil.tipoAcademico}`);
    console.log('─'.repeat(70));

    const result = await testarPerfil(perfil);
    totalOk += result.ok;
    totalFail += result.fail;
    result.details.forEach((d) => console.log(d));
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('  MULTI-TENANT - Isolamento entre instituições');
  console.log('═'.repeat(70));
  const mtResult = await testarMultiTenant();
  totalOk += mtResult.ok;
  totalFail += mtResult.fail;
  mtResult.details.forEach((d) => console.log(d));
  console.log('');

  console.log('═'.repeat(70));
  console.log('  TIPOS DE INSTITUIÇÃO - SECUNDARIO vs SUPERIOR no JWT');
  console.log('═'.repeat(70));
  const tipoResult = await testarTipoAcademico();
  totalOk += tipoResult.ok;
  totalFail += tipoResult.fail;
  tipoResult.details.forEach((d) => console.log(d));
  console.log('');

  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║  RELATÓRIO FINAL                                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`  Total: ${totalOk} passaram, ${totalFail} falharam`);

  if (totalFail > 0) {
    console.log('\n  ❌ Alguns testes falharam. Verifique o seed e o backend.\n');
    process.exit(1);
  }

  console.log('\n  ✅ Todos os perfis, multi-tenant e tipos de instituição OK!\n');
}

main().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
