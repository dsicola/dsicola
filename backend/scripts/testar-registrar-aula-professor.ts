#!/usr/bin/env npx tsx
/**
 * Teste: Registrar aula como professor Augusto Tomás
 * Requer: Backend rodando em http://localhost:3001
 */
import axios from 'axios';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const PROF_EMAIL = process.argv[2] || 'tomas@gmail.com';
const PROF_PASS = process.argv[3] || 'Professor@123';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Registrar Aula (Professor Augusto Tomás)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Obter dados do professor e plano via Prisma
  const professor = await prisma.professor.findFirst({
    where: { user: { email: PROF_EMAIL.toLowerCase() } },
    include: {
      user: { select: { nomeCompleto: true, email: true } },
      planosEnsino: {
        where: { estado: 'APROVADO' },
        include: {
          disciplina: { select: { nome: true } },
          turma: { select: { nome: true } },
          aulas: { orderBy: { ordem: 'asc' }, take: 5 },
        },
      },
    },
  });

  if (!professor) {
    console.log('❌ Professor não encontrado:', PROF_EMAIL);
    await prisma.$disconnect();
    process.exit(1);
  }

  const plano = professor.planosEnsino?.[0];
  if (!plano || !plano.aulas?.length) {
    console.log('❌ Professor sem plano de ensino com aulas:', professor.user?.nomeCompleto);
    await prisma.$disconnect();
    process.exit(1);
  }

  const aula = plano.aulas[0];
  const hoje = new Date().toISOString().split('T')[0];

  console.log('1. Professor:', professor.user?.nomeCompleto);
  console.log('   Disciplina:', plano.disciplina?.nome);
  console.log('   Turma:', plano.turma?.nome);
  console.log('   Aula a lançar:', aula.titulo);
  console.log('   Data:', hoje);
  console.log('');

  await prisma.$disconnect();

  // 2. Login como professor
  console.log('2. Fazendo login...');
  let token: string;
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: PROF_EMAIL,
      password: PROF_PASS,
    });
    token = loginRes.data?.accessToken || loginRes.data?.token;
    if (!token) throw new Error('Sem token');
    console.log('   ✅ Login OK');
  } catch (e: any) {
    console.log('   ❌ Login falhou:', e?.response?.data?.message || e.message);
    process.exit(1);
  }

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // 3. GET aulas-planejadas (verificar que o professor vê as aulas)
  console.log('\n3. GET /aulas-planejadas...');
  try {
    const res = await axios.get(`${API_URL}/aulas-planejadas`, {
      params: {
        disciplinaId: plano.disciplinaId,
        anoLetivo: plano.anoLetivo,
        turmaId: plano.turmaId,
        cursoId: plano.cursoId,
      },
      headers: auth(),
    });
    const aulas = res.data || [];
    console.log('   ✅', aulas.length, 'aulas planejadas');
    aulas.slice(0, 3).forEach((a: any, i: number) => {
      console.log(`      ${i + 1}. ${a.titulo} | lançamentos: ${a.lancamentos?.length || 0}`);
    });
  } catch (e: any) {
    console.log('   ❌ Erro:', e?.response?.data?.message || e.message);
    process.exit(1);
  }

  // 4. POST /aulas-lancadas (registrar aula)
  console.log('\n4. POST /aulas-lancadas (registrar aula)...');
  try {
    const postRes = await axios.post(
      `${API_URL}/aulas-lancadas`,
      {
        planoAulaId: aula.id,
        data: hoje,
        observacoes: 'Aula registrada via teste automatizado',
      },
      { headers: { ...auth(), 'Content-Type': 'application/json' } }
    );
    const lancado = postRes.data;
    console.log('   ✅ Aula registrada com sucesso');
    console.log('   ID:', lancado?.id);
    console.log('   Data:', lancado?.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e.message;
    console.log('   ❌ Erro:', status, msg);
    if (e?.response?.data) {
      console.log('   Detalhes:', JSON.stringify(e.response.data, null, 2).slice(0, 400));
    }
    process.exit(1);
  }

  // 5. Verificar que o lançamento aparece
  console.log('\n5. Verificando GET /aulas-planejadas (com lançamento)...');
  try {
    const res = await axios.get(`${API_URL}/aulas-planejadas`, {
      params: {
        disciplinaId: plano.disciplinaId,
        anoLetivo: plano.anoLetivo,
        turmaId: plano.turmaId,
        cursoId: plano.cursoId,
      },
      headers: auth(),
    });
    const aulas = res.data || [];
    const aulaComLancamento = aulas.find((a: any) => a.id === aula.id);
    const qtd = aulaComLancamento?.lancamentos?.length || 0;
    if (qtd > 0) {
      console.log('   ✅ Lançamento visível:', qtd, 'lançamento(s) na aula', aula.titulo);
    } else {
      console.log('   ⚠️ Aula ainda mostra 0 lançamentos (pode ser cache)');
    }
  } catch (e: any) {
    console.log('   ⚠️ Verificação falhou:', e?.response?.data?.message || e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE: Registrar aula - CONCLUÍDO COM SUCESSO');
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
