#!/usr/bin/env npx tsx
/**
 * TESTE DE CONFIGURAÇÕES DO SISTEMA
 *
 * Valida que todas as configurações (normais e avançadas) funcionam corretamente:
 * - Configurações da Instituição (GET/PUT): geral, cores, dados fiscais
 * - Parâmetros do Sistema (GET/PUT): estrutura pedagógica, regras, avaliação
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-configuracoes-sistema.ts
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
}

async function runTest(
  client: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>,
  options?: { acceptStatuses?: number[] }
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok =
      (result.status >= 200 && result.status < 300) ||
      (options?.acceptStatuses?.includes(result.status) ?? false);
    const msg = !ok ? (result.data?.message || JSON.stringify(result.data)?.slice(0, 150)) : undefined;
    return { name, ok, status: result.status, message: msg };
  } catch (err: any) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = data?.message || err.message;
    const details = data?.details || data?.error;
    const fullMsg = [msg, details].filter(Boolean).join(' | ');
    return { name, ok: false, status, message: String(fullMsg || msg).slice(0, 200) };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE CONFIGURAÇÕES DO SISTEMA - DSICOLA');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // 1. Login
  console.log('1. Login...');
  const loginRes = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('❌ Admin precisa trocar senha.');
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;
  let adminApi = api;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // Obter ADMIN de instituição (SUPER_ADMIN pode não ter instituicaoId)
  let instituicaoId: string | null = null;
  const instRes = await api.get('/instituicoes');
  if (instRes.status === 200 && Array.isArray(instRes.data) && instRes.data.length > 0) {
    instituicaoId = instRes.data[0].id;
    const adminUser = await prisma.user.findFirst({
      where: {
        instituicaoId,
        roles: { some: { role: 'ADMIN', instituicaoId } },
      },
      select: { id: true, email: true },
    });

    if (adminUser) {
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
        adminApi = axios.create({
          baseURL: API_URL,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminLogin.data.accessToken}`,
          },
          timeout: 15000,
          validateStatus: () => true,
        });
      }
    }
  }

  // 2. CONFIGURAÇÕES DA INSTITUIÇÃO
  console.log('2. Configurações da Instituição...');
  const q = () => (instituicaoId ? { instituicaoId } : {});
  results.push(
    await runTest(adminApi, 'GET /configuracoes-instituicao', async () => {
      const r = await adminApi.get('/configuracoes-instituicao', { params: q() });
      return { status: r.status, data: r.data };
    })
  );

  const getConfig = await adminApi.get('/configuracoes-instituicao');
  const currentConfig = getConfig.status === 200 ? getConfig.data : null;

  results.push(
    await runTest(adminApi, 'PUT /configuracoes-instituicao (update mínimo)', async () => {
      const payload = {
        nomeInstituicao: (currentConfig?.nomeInstituicao || currentConfig?.nome_instituicao || 'Instituição Teste').toString().trim(),
        emailFiscal: (currentConfig?.emailFiscal || currentConfig?.email_fiscal || 'fiscal@teste.ao').toString().trim(),
      };
      const r = await adminApi.put('/configuracoes-instituicao', payload, instituicaoId ? { params: { instituicaoId } } : {});
      return { status: r.status, data: r.data };
    })
  );

  results.push(
    await runTest(adminApi, 'PUT /configuracoes-instituicao (cores)', async () => {
      const r = await adminApi.put('/configuracoes-instituicao', {
        corPrimaria: '#8B5CF6',
        corSecundaria: '#1F2937',
        corTerciaria: '#F8FAFC',
      }, instituicaoId ? { params: { instituicaoId } } : {});
      return { status: r.status, data: r.data };
    })
  );

  // 3. PARÂMETROS DO SISTEMA
  console.log('3. Parâmetros do Sistema (avançadas)...');
  results.push(
    await runTest(adminApi, 'GET /parametros-sistema', async () => {
      const r = await adminApi.get('/parametros-sistema');
      return { status: r.status, data: r.data };
    })
  );

  const getParam = await adminApi.get('/parametros-sistema');
  // Tipo acadêmico: SUPERIOR usa semestres, SECUNDARIO não
  const instData = await (instituicaoId ? prisma.instituicao.findUnique({ where: { id: instituicaoId }, select: { tipoAcademico: true } }) : Promise.resolve(null));
  const tipoAcademico = instData?.tipoAcademico || null;

  const parametrosPayload: any = {
    permitirReprovacaoDisciplina: true,
    permitirDependencia: true,
    permitirMatriculaForaPeriodo: false,
    bloquearMatriculaDivida: true,
    permitirTransferenciaTurma: true,
    permitirMatriculaSemDocumentos: false,
    tipoMedia: 'simples',
    permitirExameRecurso: false,
    percentualMinimoAprovacao: 10,
    perfisAlterarNotas: ['ADMIN', 'PROFESSOR'],
    perfisCancelarMatricula: ['ADMIN'],
    ativarLogsAcademicos: true,
  };

  if (tipoAcademico === 'SUPERIOR') {
    parametrosPayload.quantidadeSemestresPorAno = 2;
  }

  results.push(
    await runTest(adminApi, 'PUT /parametros-sistema', async () => {
      const r = await adminApi.put('/parametros-sistema', parametrosPayload);
      return { status: r.status, data: r.data };
    })
  );

  // Verificar que GET retorna os dados atualizados
  results.push(
    await runTest(adminApi, 'GET /parametros-sistema (verificar persistência)', async () => {
      const r = await adminApi.get('/parametros-sistema');
      const ok =
        r.status === 200 &&
        r.data?.tipoMedia === 'simples' &&
        Array.isArray(r.data?.perfisAlterarNotas);
      return { status: ok ? 200 : 500, data: r.data };
    })
  );

  // 4. Resumo
  console.log('\n═══════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.status ? ` (${r.status})` : ''}`);
    if (!r.ok && r.message) console.log(`      ${r.message}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Total: ${passed}/${results.length} testes passaram`);
  if (failed.length > 0) {
    console.log(`  Falharam: ${failed.map((f) => f.name).join(', ')}`);
    process.exit(1);
  }
  console.log('  ✅ Todas as configurações estão funcionais!\n');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
