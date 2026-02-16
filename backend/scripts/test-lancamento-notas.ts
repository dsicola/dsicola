#!/usr/bin/env npx tsx
/**
 * TESTE: Lançamento de Notas
 *
 * Testa o fluxo completo de lançamento de notas:
 * 1. Login como admin
 * 2. Listar avaliações disponíveis
 * 3. Buscar alunos para lançar notas
 * 4. Lançar notas em lote
 * 5. Verificar se as notas foram persistidas
 *
 * Requer: Backend rodando + dados de teste (instituição, turma, matrícula, avaliação)
 * Uso: npx tsx scripts/test-lancamento-notas.ts
 *      ADMIN_EMAIL=xxx ADMIN_PASS=xxx INSTITUICAO_ID=xxx npx tsx scripts/test-lancamento-notas.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'superadmin@dsicola.com';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || process.env.ADMIN_PASS || 'SuperAdmin@123';
const INSTITUICAO_ID = process.env.INSTITUICAO_ID;

function log(ok: boolean, msg: string) {
  console.log(`  ${ok ? '✅' : '❌'} ${msg}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Lançamento de Notas');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}`);
  console.log(`Admin: ${ADMIN_EMAIL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // 1. Login
  console.log('1. Login...');
  const loginRes = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = loginRes.data?.accessToken || loginRes.data?.token;
  if (loginRes.status !== 200 || !token) {
    log(false, `Login falhou: ${loginRes.data?.message || loginRes.status}`);
    process.exit(1);
  }
  log(true, 'Login OK');
  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // 2. Buscar planos de ensino (para obter avaliacoes)
  console.log('\n2. Buscar planos de ensino...');
  const planosRes = await adminApi.get('/plano-ensino', {
    params: { instituicaoId: INSTITUICAO_ID || undefined },
  });
  if (planosRes.status !== 200 || !Array.isArray(planosRes.data)) {
    log(false, `Planos não encontrados: ${planosRes.data?.message || planosRes.status}`);
    process.exit(1);
  }
  const planos = planosRes.data;
  if (planos.length === 0) {
    log(false, 'Nenhum plano de ensino encontrado. Execute o seed ou crie dados de teste.');
    process.exit(1);
  }
  log(true, `${planos.length} plano(s) encontrado(s)`);

  // 3. Buscar avaliações do primeiro plano
  const planoId = planos[0].id;
  console.log('\n3. Buscar avaliações...');
  const avaliacoesRes = await adminApi.get('/avaliacoes', {
    params: { planoEnsinoId: planoId },
  });
  if (avaliacoesRes.status !== 200) {
    log(false, `Erro ao buscar avaliações: ${avaliacoesRes.data?.message || avaliacoesRes.status}`);
    process.exit(1);
  }
  const avaliacoes = Array.isArray(avaliacoesRes.data) ? avaliacoesRes.data : [];
  if (avaliacoes.length === 0) {
    log(false, 'Nenhuma avaliação encontrada. Crie uma avaliação no plano de ensino primeiro.');
    process.exit(1);
  }
  log(true, `${avaliacoes.length} avaliação(ões) encontrada(s)`);

  // 4. Buscar alunos para lançar notas
  const avaliacaoId = avaliacoes[0].id;
  console.log('\n4. Buscar alunos para lançar notas...');
  const alunosRes = await adminApi.get(`/notas/avaliacao/${avaliacaoId}/alunos`);
  if (alunosRes.status !== 200) {
    log(false, `Erro ao buscar alunos: ${alunosRes.data?.message || alunosRes.status}`);
    process.exit(1);
  }
  const alunosData = alunosRes.data?.alunos ?? [];
  if (!Array.isArray(alunosData) || alunosData.length === 0) {
    log(false, 'Nenhum aluno matriculado na turma desta avaliação.');
    process.exit(1);
  }
  log(true, `${alunosData.length} aluno(s) encontrado(s)`);

  // 5. Lançar notas
  const notaValor = 14;
  const notas = alunosData.slice(0, 3).map((a: { alunoId: string }) => ({
    alunoId: a.alunoId,
    valor: notaValor,
    observacoes: 'Nota de teste automático',
  }));

  if (notas.length === 0) {
    log(false, 'Nenhum aluno para lançar nota.');
    process.exit(1);
  }

  console.log('\n5. Lançar notas em lote...');
  const lancarRes = await adminApi.post('/notas/avaliacao/lote', {
    avaliacaoId,
    notas,
  });

  if (lancarRes.status >= 400) {
    log(false, `Erro ao lançar notas: ${lancarRes.data?.message || JSON.stringify(lancarRes.data)}`);
    process.exit(1);
  }
  log(true, `Notas lançadas: ${notas.length} registro(s)`);

  // 6. Verificar se as notas foram persistidas
  console.log('\n6. Verificar persistência...');
  const alunosCheckRes = await adminApi.get(`/notas/avaliacao/${avaliacaoId}/alunos`);
  if (alunosCheckRes.status !== 200) {
    log(false, 'Não foi possível verificar as notas.');
    process.exit(1);
  }
  const alunosApos = alunosCheckRes.data?.alunos ?? [];
  const comNota = alunosApos.filter((a: { nota?: { valor: number } }) => a.nota?.valor !== undefined);
  log(true, `${comNota.length} aluno(s) com nota lançada`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE CONCLUÍDO COM SUCESSO');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\nErro fatal:', err.message);
  process.exit(1);
});
