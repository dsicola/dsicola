#!/usr/bin/env npx tsx
/**
 * TESTE E2E COMPLETO: Plano de Ensino + Painel do Professor
 *
 * Fluxo passo a passo:
 * 1. Garantir professor com Plano de Ensino (via Prisma ou script existente)
 * 2. Login como ADMIN (superadmin) - verificar contexto
 * 3. Login como PROFESSOR - verificar painel completo
 * 4. Validar: GET /turmas/professor, GET /professor-disciplinas/me, GET /aulas-planejadas
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/testar-plano-ensino-e-painel-professor-e2e.ts [email_admin] [pass_admin] [email_professor] [pass_professor]
 */
import axios from 'axios';
import prisma from '../src/lib/prisma.js';

const API_URL = process.env.API_URL || 'http://localhost:3001';

function log(msg: string, level: 'info' | 'ok' | 'fail' | 'warn' = 'info') {
  const prefix = level === 'ok' ? '   ✅' : level === 'fail' ? '   ❌' : level === 'warn' ? '   ⚠️' : '   ';
  console.log(prefix, msg);
}

async function main() {
  const adminEmail = process.argv[2] || process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
  const adminPass = process.argv[3] || process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
  const profEmail = process.argv[4] || process.env.TEST_PROF_EMAIL || 'avelino1@gmail.com';
  const profPass = process.argv[5] || process.env.TEST_PROF_PASS || 'Professor@123';

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE E2E COMPLETO: Plano de Ensino → Painel do Professor');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');


  // ─── FASE 0: Verificar dados do Professor via Prisma ─────────────────────────────────────────
  console.log('FASE 0: Verificando dados do professor via Prisma...\n');

  const professor = await prisma.professor.findFirst({
    where: { user: { email: profEmail.toLowerCase() } },
    include: {
      user: { select: { email: true, nomeCompleto: true } },
      instituicao: { select: { id: true, nome: true, tipoAcademico: true } },
      planosEnsino: {
        include: {
          disciplina: { select: { id: true, nome: true } },
          turma: { select: { id: true, nome: true } },
          anoLetivoRef: { select: { ano: true, id: true } },
          aulas: { orderBy: { ordem: 'asc' }, take: 5 },
        },
      },
    },
  });

  if (!professor) {
    console.log('❌ Professor não encontrado:', profEmail);
    console.log('   Execute primeiro: npx tsx scripts/testar-atribuicao-plano-completo.ts ' + profEmail);
    await prisma.$disconnect();
    process.exit(1);
  }

  const planos = professor.planosEnsino || [];
  const planoComTurma = planos.find((p) => p.turmaId);
  const planoComAulas = planos.find((p) => p.aulas && p.aulas.length > 0);

  console.log('   Professor:', professor.user?.nomeCompleto, `(${professor.user?.email})`);
  console.log('   professores.id:', professor.id);
  console.log('   Instituição:', professor.instituicao?.nome);
  console.log('   Planos de Ensino:', planos.length);
  planos.forEach((p) => {
    console.log(`      • ${p.disciplina?.nome} | Turma: ${p.turma?.nome || '(sem turma)'} | Ano: ${p.anoLetivoRef?.ano || p.anoLetivo}`);
  });
  console.log('');

  if (planos.length === 0) {
    console.log('⚠️  Professor sem planos de ensino. Execute: npx tsx scripts/testar-atribuicao-plano-completo.ts ' + profEmail);
    console.log('   Continuando com testes de API (podem falhar)...\n');
  }

  // Obter dados para GET /aulas-planejadas (como ADMIN)
  const planoRef = planoComAulas || planoComTurma || planos[0];
  const disciplinaId = planoRef?.disciplinaId;
  const anoLetivo = planoRef?.anoLetivo ?? planoRef?.anoLetivoRef?.ano;
  const turmaId = planoRef?.turmaId;
  const cursoId = planoRef?.cursoId;
  const classeId = planoRef?.classeId;

  // ─── FASE 1: Login como ADMIN ───────────────────────────────────────────────────────────────
  console.log('FASE 1: Login como ADMIN...\n');

  let adminToken: string;
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, { email: adminEmail, password: adminPass });
    adminToken = loginRes.data?.accessToken || loginRes.data?.token;
    if (!adminToken) {
      log('Login sem token', 'fail');
      await prisma.$disconnect();
      process.exit(1);
    }
    log('Login ADMIN OK', 'ok');
  } catch (e: any) {
    const msg = e?.response?.data?.message || e.message;
    const code = e?.code;
    if (code === 'ECONNREFUSED') {
      log('Backend não alcançável. Inicie: cd backend && npm run dev', 'fail');
    } else {
      log('Login ADMIN falhou: ' + msg, 'fail');
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  const authAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  // Verificar GET /plano-ensino (contexto) - SUPER_ADMIN precisa de instituicaoId
  try {
    const params: Record<string, string> = { professorId: professor.id };
    if (planoRef?.anoLetivoId) params.anoLetivoId = planoRef.anoLetivoId;
    if (professor.instituicaoId) params.instituicaoId = professor.instituicaoId;
    const ctxRes = await axios.get(`${API_URL}/plano-ensino`, {
      params,
      headers: authAdmin(),
    });
    const planosApi = Array.isArray(ctxRes.data) ? ctxRes.data : [ctxRes.data].filter(Boolean);
    log(`GET /plano-ensino: ${planosApi.length} plano(s) para o professor`, 'ok');
  } catch (e: any) {
    log('GET /plano-ensino: ' + (e?.response?.data?.message || e.message), 'warn');
  }

  // ─── FASE 2: Login como PROFESSOR ───────────────────────────────────────────────────────────
  console.log('\nFASE 2: Login como PROFESSOR...\n');

  let profToken: string;
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, { email: profEmail, password: profPass });
    profToken = loginRes.data?.accessToken || loginRes.data?.token;
    if (!profToken) {
      log('Login sem token', 'fail');
      await prisma.$disconnect();
      process.exit(1);
    }
    log('Login PROFESSOR OK', 'ok');
  } catch (e: any) {
    const msg = e?.response?.data?.message || e.message;
    log('Login PROFESSOR falhou: ' + msg + (msg.includes('credenciais') ? ' (verifique a senha do professor)' : ''), 'fail');
    await prisma.$disconnect();
    process.exit(1);
  }

  const authProf = () => ({ Authorization: `Bearer ${profToken}` });

  // ─── FASE 3: GET /turmas/professor (Painel do Professor) ────────────────────────────────────
  console.log('\nFASE 3: Painel do Professor - GET /turmas/professor...\n');

  let turmasData: { anoLetivo?: number; turmas?: any[]; disciplinasSemTurma?: any[] } = {};
  try {
    const res = await axios.get(`${API_URL}/turmas/professor`, {
      params: { incluirPendentes: 'true' },
      headers: authProf(),
    });
    turmasData = res.data || {};
    const turmas = turmasData.turmas || [];
    const semTurma = turmasData.disciplinasSemTurma || [];
    log(`Ano Letivo: ${turmasData.anoLetivo ?? 'N/A'}`, 'info');
    log(`Turmas atribuídas: ${turmas.length}`, 'info');
    turmas.forEach((t: any) => {
      log(`   • ${t.disciplinaNome || t.disciplina?.nome} → Turma: ${t.turma?.nome || t.nome}`, 'info');
    });
    log(`Disciplinas sem turma: ${semTurma.length}`, 'info');
    semTurma.forEach((d: any) => {
      log(`   • ${d.disciplinaNome || d.nome} (aguardando turma)`, 'info');
    });

    if (turmas.length > 0 || semTurma.length > 0) {
      log('Painel do Professor retornou atribuições corretamente', 'ok');
    } else if (planos.length > 0) {
      log('AVISO: Professor tem planos no banco mas /turmas/professor retornou vazio', 'warn');
    } else {
      log('Professor sem atribuições (esperado se não houver planos)', 'info');
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e.message;
    log(`GET /turmas/professor falhou: ${status} ${msg}`, 'fail');
    if (e?.response?.data) {
      console.log('   Detalhes:', JSON.stringify(e.response.data, null, 2).slice(0, 400));
    }
  }

  // ─── FASE 4: GET /professor-disciplinas/me ──────────────────────────────────────────────────
  console.log('\nFASE 4: Minhas Disciplinas - GET /professor-disciplinas/me...\n');

  try {
    const res = await axios.get(`${API_URL}/professor-disciplinas/me`, { headers: authProf() });
    const atribuicoes = res.data || [];
    log(`Atribuições retornadas: ${atribuicoes.length}`, 'info');
    atribuicoes.forEach((a: any) => {
      log(`   • ${a.disciplina?.nome} | Ano: ${a.ano} | Semestre: ${a.semestre ?? '-'}`, 'info');
    });
    if (atribuicoes.length > 0) {
      log('GET /professor-disciplinas/me OK', 'ok');
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.message || e.message;
    log(`GET /professor-disciplinas/me falhou: ${status} ${msg}`, 'fail');
  }

  // ─── FASE 5: GET /aulas-planejadas (como PROFESSOR - sem professorId) ──────────────────────
  if (disciplinaId && anoLetivo) {
    console.log('\nFASE 5: Aulas Planejadas - GET /aulas-planejadas (como PROFESSOR)...\n');

    const params: Record<string, string | number> = {
      disciplinaId,
      anoLetivo: Number(anoLetivo),
    };
    if (turmaId) params.turmaId = turmaId;
    if (cursoId) params.cursoId = cursoId;
    if (classeId) params.classeId = classeId;

    try {
      const res = await axios.get(`${API_URL}/aulas-planejadas`, {
        params,
        headers: authProf(),
      });
      const aulas = res.data || [];
      log(`Aulas planejadas retornadas: ${aulas.length}`, 'info');
      aulas.slice(0, 5).forEach((a: any, i: number) => {
        log(`   ${i + 1}. ${a.titulo} | ${a.status} | lançamentos: ${a.lancamentos?.length || 0}`, 'info');
      });
      if (aulas.length > 0) {
        log('GET /aulas-planejadas (PROFESSOR) OK', 'ok');
      } else if (planoRef?.aulas && planoRef.aulas.length > 0) {
        log('AVISO: Plano tem aulas no banco mas API retornou vazio (verificar turmaId/contexto)', 'warn');
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e.message;
      log(`GET /aulas-planejadas falhou: ${status} ${msg}`, 'fail');
      if (e?.response?.data) {
        console.log('   Detalhes:', JSON.stringify(e.response.data, null, 2).slice(0, 400));
      }
    }
  } else {
    console.log('\nFASE 5: Aulas Planejadas - omitido (sem plano com disciplina/ano)\n');
  }

  // ─── FASE 6: GET /aulas-planejadas como ADMIN (com professorId) ─────────────────────────────
  if (disciplinaId && anoLetivo) {
    console.log('\nFASE 6: Aulas Planejadas - GET /aulas-planejadas (como ADMIN)...\n');

    const params: Record<string, string | number> = {
      disciplinaId,
      professorId: professor.id,
      anoLetivo: Number(anoLetivo),
    };
    if (turmaId) params.turmaId = turmaId;
    if (cursoId) params.cursoId = cursoId;
    if (classeId) params.classeId = classeId;
    if (professor.instituicaoId) params.instituicaoId = professor.instituicaoId;

    try {
      const res = await axios.get(`${API_URL}/aulas-planejadas`, {
        params,
        headers: authAdmin(),
      });
      const aulas = res.data || [];
      log(`Aulas planejadas (ADMIN): ${aulas.length}`, 'info');
      if (aulas.length > 0) {
        log('GET /aulas-planejadas (ADMIN) OK', 'ok');
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e.message;
      log(`GET /aulas-planejadas (ADMIN) falhou: ${status} ${msg}`, 'fail');
    }
  }

  // ─── RESUMO ────────────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - Teste E2E Plano de Ensino + Painel Professor');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  • Professor:', professor.user?.nomeCompleto);
  console.log('  • Planos no banco:', planos.length);
  console.log('  • Turmas no painel:', turmasData.turmas?.length ?? 0);
  console.log('  • Disciplinas sem turma:', turmasData.disciplinasSemTurma?.length ?? 0);
  console.log('\n  ✅ Teste concluído. Verifique os logs acima para erros.\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
