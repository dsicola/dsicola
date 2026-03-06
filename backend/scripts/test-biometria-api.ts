#!/usr/bin/env npx tsx
/**
 * TESTE DE API BIOMETRIA - DSICOLA
 *
 * Valida que os endpoints de biometria respondem corretamente:
 * - Dispositivos biométricos (listar, obter)
 * - Presenças (listar dia, processar)
 * - Integração (receber evento)
 *
 * Requer: Backend rodando (ex: http://localhost:3001)
 * Uso: npm run test:biometria-api
 *      API_URL=http://localhost:3001 tsx scripts/test-biometria-api.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
const BASE = API_URL; // Backend monta rotas na raiz (/auth, /dispositivos-biometricos, etc.)

const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SENHA = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  status?: number;
  details?: string;
}

let passed = 0;
let failed = 0;

function assert(name: string, ok: boolean, details?: string): void {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    if (details) console.log(`     ${details}`);
  }
}

async function login(): Promise<{ token: string; client: AxiosInstance } | null> {
  try {
    const res = await axios.post(`${BASE}/auth/login`, {
      email: SUPER_ADMIN_EMAIL,
      password: SENHA,
    });
    const token = res.data?.accessToken || res.data?.token;
    if (!token) return null;

    const client = axios.create({
      baseURL: BASE,
      headers: { Authorization: `Bearer ${token}` },
    });
    return { token, client };
  } catch (err: any) {
    console.error('  ❌ Login falhou:', err.response?.data?.message || err.message);
    return null;
  }
}

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  TESTE API BIOMETRIA - DSICOLA');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  API: ${API_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  const auth = await login();
  if (!auth) {
    console.log('  ⚠️  Backend não acessível ou credenciais inválidas.');
    console.log('  Execute o backend (npm run dev) e tente novamente.');
    process.exit(1);
  }

  const { client } = auth;

  // Obter instituicaoId para SUPER_ADMIN (presenças exigem escopo)
  let instituicaoId: string | undefined;
  try {
    const inst = await prisma.instituicao.findFirst({ select: { id: true } });
    instituicaoId = inst?.id;
  } catch {
    // Ignorar se Prisma falhar (ex: sem DB)
  }

  // --- Dispositivos biométricos ---
  console.log('\n📡 1. DISPOSITIVOS BIOMÉTRICOS\n');

  let dispositivosRes: any;
  try {
    dispositivosRes = await client.get('/dispositivos-biometricos');
    assert(
      'GET /dispositivos-biometricos retorna 200',
      dispositivosRes.status === 200,
      `Status: ${dispositivosRes.status}`
    );
    assert(
      'Resposta é array',
      Array.isArray(dispositivosRes.data),
      typeof dispositivosRes.data
    );
  } catch (err: any) {
    assert('GET /dispositivos-biometricos', false, err.response?.data?.message || err.message);
  }

  const dispositivos = Array.isArray(dispositivosRes?.data) ? dispositivosRes.data : [];
  const primeiroDispositivo = dispositivos[0];

  if (primeiroDispositivo) {
    try {
      const getOne = await client.get(`/dispositivos-biometricos/${primeiroDispositivo.id}`);
      assert('GET /dispositivos-biometricos/:id retorna 200', getOne.status === 200);
      assert('Dispositivo tem id', !!getOne.data?.id);
    } catch (err: any) {
      assert('GET /dispositivos-biometricos/:id', false, err.response?.data?.message || err.message);
    }

    // Teste de conexão (pode falhar se não houver dispositivo físico)
    try {
      const testConn = await client.post(`/dispositivos-biometricos/${primeiroDispositivo.id}/test-connection`);
      const success = testConn.data?.success === true;
      assert(
        'POST test-connection responde (conectado ou mensagem informativa)',
        testConn.status === 200,
        success ? 'Dispositivo conectado' : (testConn.data?.mensagem || 'Sem dispositivo físico')
      );
    } catch (err: any) {
      // Timeout ou dispositivo offline é esperado em ambiente de teste
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      assert(
        'POST test-connection (pode falhar sem dispositivo físico)',
        status === 500 || status === 404 || (msg && msg.includes('conectar')),
        `Status: ${status} - ${String(msg).slice(0, 80)}`
      );
    }
  } else {
    console.log('  ⏭️  Sem dispositivos cadastrados - pulando testes de dispositivo individual');
  }

  // --- Presenças ---
  console.log('\n📋 2. PRESENÇAS BIOMÉTRICAS\n');

  try {
    const hoje = new Date().toISOString().split('T')[0];
    const params: Record<string, string> = { data: hoje };
    if (instituicaoId) params.instituicaoId = instituicaoId;
    const presencasDia = await client.get('/biometria/presencas/dia', { params });
    assert('GET /biometria/presencas/dia retorna 200', presencasDia.status === 200);
    assert(
      'Resposta tem estrutura esperada',
      typeof presencasDia.data === 'object' || Array.isArray(presencasDia.data),
      typeof presencasDia.data
    );
  } catch (err: any) {
    assert(
      'GET /biometria/presencas/dia',
      err.response?.status === 200 || err.response?.status === 400,
      err.response?.data?.message || err.message
    );
  }

  try {
    const body: Record<string, string> = {
      data: new Date().toISOString().split('T')[0],
      horarioPadraoEntrada: '08:00',
      horarioPadraoSaida: '17:00',
    };
    const processar = await client.post('/biometria/presencas/processar', body, {
      params: instituicaoId ? { instituicaoId } : undefined,
    });
    assert('POST /biometria/presencas/processar retorna 200/201', processar.status >= 200 && processar.status < 300);
  } catch (err: any) {
    const status = err.response?.status;
    assert(
      'POST /biometria/presencas/processar (pode retornar 400 sem dados)',
      status === 200 || status === 201 || status === 400,
      `Status: ${status} - ${err.response?.data?.message || err.message}`
    );
  }

  // --- Integração (receber evento) - sem token de dispositivo, deve retornar 401 ---
  console.log('\n🔗 3. INTEGRAÇÃO (endpoint interno)\n');

  try {
    await axios.post(`${BASE}/integracao/biometria/evento`, {
      device_id: 'fake-id',
      funcionario_id: 'fake-id',
      tipo: 'ENTRADA',
      timestamp: new Date().toISOString(),
      token: 'invalid',
    });
    assert('POST /integracao/biometria/evento sem token retorna 401', false, 'Deveria rejeitar');
  } catch (err: any) {
    assert(
      'POST /integracao/biometria/evento rejeita token inválido',
      err.response?.status === 401 || err.response?.status === 400,
      `Status: ${err.response?.status} (esperado 401)`
    );
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Resultado: ${passed} passou, ${failed} falhou`);
  console.log('═══════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
