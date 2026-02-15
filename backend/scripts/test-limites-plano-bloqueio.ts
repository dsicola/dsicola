#!/usr/bin/env npx tsx
/**
 * TESTE: Bloqueio por limite de plano
 *
 * Verifica que instituições são BLOQUEADAS ao exceder limite+ tolerância de alunos.
 * - Cria plano com limite 1 (tolerância 10% = limite efetivo 2)
 * - Cria 2 alunos (dentro do limite + tolerância)
 * - Tenta criar 3º aluno → deve FALHAR com erro 403
 * - Aprovar candidatura no limite → deve FALHAR
 *
 * Requer: Backend rodando (localhost:3001)
 */
import axios from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

const TS = Date.now();
const SUBDOMINIO = `teste-limite-${TS}`.slice(0, 50);
const INST_NOME = `Inst Teste Limite ${TS}`;
const ADMIN_EMAIL = `admin.limite.${TS}@teste.dsicola.com`;
const ADMIN_PASS = 'TesteLimite@123';

function createApi(token?: string) {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    timeout: 15000,
    validateStatus: () => true,
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: BLOQUEIO POR LIMITE DE PLANO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const api = createApi();

  // 1. Plano com limite 1 (tolerância 10% = limite efetivo 2, então 2 alunos OK, 3º bloqueia)
  const plano = await prisma.plano.create({
    data: {
      nome: `Teste Limite 1 ${TS}`,
      descricao: 'Plano teste limite + tolerância',
      tipoAcademico: 'SECUNDARIO',
      valorMensal: 1000,
      valorAnual: 10000,
      limiteAlunos: 1,
      ativo: true,
    },
  });
  console.log(`   ✓ Plano: ${plano.nome} (limite: ${plano.limiteAlunos}, +10% tolerância = 2)\n`);

  // 2. Login SUPER_ADMIN e criar instituição
  const loginRes = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('   ✖ Login SUPER_ADMIN falhou');
    process.exit(1);
  }
  const apiSuper = createApi(loginRes.data.accessToken);

  const onboardingRes = await apiSuper.post('/onboarding/instituicao', {
    nomeInstituicao: INST_NOME,
    subdominio: SUBDOMINIO,
    tipoAcademico: 'SECUNDARIO',
    emailContato: ADMIN_EMAIL,
    emailAdmin: ADMIN_EMAIL,
    senhaAdmin: ADMIN_PASS,
    nomeAdmin: 'Admin Teste Limite',
    planoId: plano.id,
  });
  if (onboardingRes.status !== 201 || !onboardingRes.data?.instituicao?.id) {
    console.error('   ✖ Falha ao criar instituição:', onboardingRes.data?.message);
    process.exit(1);
  }
  const instituicaoId = onboardingRes.data.instituicao.id;
  console.log(`   ✓ Instituição criada: ${instituicaoId}\n`);

  // 3. Login como ADMIN da instituição
  const adminLogin = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (adminLogin.status !== 200 || !adminLogin.data?.accessToken) {
    console.error('   ✖ Login ADMIN falhou');
    process.exit(1);
  }
  const apiAdmin = createApi(adminLogin.data.accessToken);

  // 4. Criar 2 alunos (dentro do limite)
  console.log('4. Criar 2 alunos (dentro do limite)...');
  for (let i = 1; i <= 2; i++) {
    const res = await apiAdmin.post('/users', {
      email: `aluno${i}.limite.${TS}@teste.dsicola.com`,
      role: 'ALUNO',
      nome_completo: `Aluno Teste ${i}`,
      numero_identificacao: `LIM${TS}${i}`,
    });
    if (res.status !== 201 && res.status !== 200) {
      console.error(`   ✖ Falha ao criar aluno ${i}:`, res.data?.message);
      process.exit(1);
    }
    console.log(`   ✓ Aluno ${i} criado`);
  }

  // 5. Tentar criar 3º aluno → DEVE BLOQUEAR (403)
  console.log('\n5. Tentar criar 3º aluno (exceder limite) → DEVE BLOQUEAR...');
  const resBloqueio = await apiAdmin.post('/users', {
    email: `aluno3.limite.${TS}@teste.dsicola.com`,
    role: 'ALUNO',
    nome_completo: 'Aluno Teste 3',
    numero_identificacao: `LIM${TS}3`,
  });
  if (resBloqueio.status === 403 && resBloqueio.data?.message?.includes('Limite')) {
    console.log('   ✓ BLOQUEIO CORRETO: Erro 403 - Limite de alunos atingido');
  } else {
    console.error('   ✖ FALHA: Deveria ter bloqueado com 403. Recebido:', resBloqueio.status, resBloqueio.data?.message);
    process.exit(1);
  }

  // 6. Candidatura: criar e tentar aprovar (no limite) → DEVE BLOQUEAR
  console.log('\n6. Candidatura: aprovar no limite → DEVE BLOQUEAR...');
  const candidaturaRes = await api.post('/candidaturas', {
    nomeCompleto: 'Candidato Limite Teste',
    email: `candidato.limite.${TS}@teste.dsicola.com`,
    numeroIdentificacao: `CAND${TS}`,
    telefone: '+244 900 000 001',
    dataNascimento: '2000-01-01',
    genero: 'M',
    morada: 'Rua Teste',
    cidade: 'Luanda',
    pais: 'Angola',
    instituicaoId,
  });
  if (candidaturaRes.status !== 201 && candidaturaRes.status !== 200) {
    console.error('   ✖ Falha ao criar candidatura:', candidaturaRes.data);
    process.exit(1);
  }
  const candidaturaId = candidaturaRes.data.id;

  const aprovarRes = await apiAdmin.post(`/candidaturas/${candidaturaId}/aprovar`);
  if (aprovarRes.status === 403 && aprovarRes.data?.message?.includes('Limite')) {
    console.log('   ✓ BLOQUEIO CORRETO: Aprovar candidatura bloqueada - Limite atingido');
  } else {
    console.error('   ✖ FALHA: Aprovar candidatura deveria ter bloqueado. Recebido:', aprovarRes.status, aprovarRes.data?.message);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ TODOS OS BLOQUEIOS FUNCIONANDO CORRETAMENTE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Cleanup opcional (plano pode ter assinaturas vinculadas)
  // Dados de teste podem permanecer - não afetam produção
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
