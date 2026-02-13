#!/usr/bin/env npx tsx
/**
 * TESTE E2E: Lançamento de Aulas via API
 *
 * Requer: Backend rodando em http://localhost:3001
 * Faz login, chama GET /aulas-planejadas com professorId e verifica resposta.
 *
 * Uso: npx tsx scripts/testar-lancamento-aulas-e2e.ts [email] [password]
 */
import axios from 'axios';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function main() {
  const email = process.argv[2] || process.env.TEST_EMAIL;
  const password = process.argv[3] || process.env.TEST_PASSWORD;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE E2E: Lançamento de Aulas (API)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Obter dados do plano via Prisma
  const plano = await prisma.planoEnsino.findFirst({
    where: { aulas: { some: {} } },
    include: {
      disciplina: { select: { id: true, nome: true } },
      professor: { select: { id: true } },
      curso: { select: { id: true } },
      turma: { select: { id: true } },
    },
  });
  await prisma.$disconnect();

  if (!plano) {
    console.log('❌ Nenhum Plano de Ensino com aulas. Execute: npx tsx scripts/testar-atribuicao-plano-completo.ts');
    process.exit(1);
  }

  const params: Record<string, string | number> = {
    disciplinaId: plano.disciplinaId,
    professorId: plano.professorId,
    anoLetivo: plano.anoLetivo,
    cursoId: plano.cursoId || undefined,
    turmaId: plano.turmaId || undefined,
  };
  // SUPER_ADMIN sem instituicaoId precisa enviar no query
  if (plano.instituicaoId) {
    params.instituicaoId = plano.instituicaoId;
  }

  console.log('1. Dados do plano (via Prisma)');
  console.log('   Disciplina:', plano.disciplina?.nome);
  console.log('   professorId:', params.professorId);
  console.log('   anoLetivo:', params.anoLetivo);
  console.log('');

  if (!email || !password) {
    console.log('⚠️  Credenciais não fornecidas. Teste de API requer login.');
    console.log('   Use: npx tsx scripts/testar-lancamento-aulas-e2e.ts EMAIL PASSWORD');
    console.log('   Ou: TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/testar-lancamento-aulas-e2e.ts');
    console.log('');
    console.log('   Parâmetros que seriam enviados ao backend:');
    console.log('   GET /aulas-planejadas?' + new URLSearchParams(params as any).toString());
    console.log('');
    process.exit(0);
  }

  // 2. Login
  console.log('2. Fazendo login...');
  let token: string;
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
    token = loginRes.data?.accessToken || loginRes.data?.token;
    if (!token) {
      console.log('   ❌ Login sem token. Resposta:', JSON.stringify(loginRes.data, null, 2).slice(0, 200));
      process.exit(1);
    }
    console.log('   ✅ Login OK');
  } catch (e: any) {
    console.log('   ❌ Login falhou:', e?.response?.data?.message || e.message);
    process.exit(1);
  }

  // 3. Chamar GET /aulas-planejadas
  console.log('\n3. Chamando GET /aulas-planejadas...');
  try {
    const res = await axios.get(`${API_URL}/aulas-planejadas`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    const aulas = res.data || [];
    console.log('   ✅ Resposta:', aulas.length, 'aulas');
    if (aulas.length > 0) {
      aulas.slice(0, 3).forEach((a: any, i: number) => {
        console.log(`      ${i + 1}. ${a.titulo} | ${a.status} | lançamentos: ${a.lancamentos?.length || 0}`);
      });
    }
    console.log('\n   ✅ TESTE E2E OK');
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e.message;
    console.log('   ❌ Erro:', status, msg);
    if (e?.response?.data) {
      console.log('   Detalhes:', JSON.stringify(e.response.data, null, 2).slice(0, 300));
    }
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
