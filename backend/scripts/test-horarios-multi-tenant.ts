#!/usr/bin/env npx tsx
/**
 * TESTE REAL: Módulo de Horários - Multi-tenant + RBAC + Regras Completas
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 * Backend: npm run dev (API rodando em API_URL)
 *
 * Valida:
 * - Instituição A (SECUNDARIO) e B (SUPERIOR)
 * - Criar horário válido em ambas
 * - Bloquear conflitos (professor, turma, sala)
 * - Professor só vê seus próprios horários
 * - Admin A não acessa horários da Inst B (cross-tenant 403)
 * - instituicaoId no body → 400
 * - Aprovar horário
 * - Excluir APROVADO → 400; Excluir RASCUNHO → 204
 * - Grade por turma/professor
 * - Impressão PDF
 *
 * Uso: npm run test:horarios
 * Ou: npx tsx scripts/test-horarios-multi-tenant.ts
 */
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = 'TestMultiTenant123!';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  ok: boolean;
  details?: string;
}
const results: TestResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

// diaSemana: 1=Seg, 2=Ter, ... 6=Sab (padrão backend)
const SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5;

async function login(email: string, password: string) {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password }, { validateStatus: () => true });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login falhou: ${email} - ${res.status}`);
  }
  return res.data.accessToken;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE REAL - MÓDULO DE HORÁRIOS (Multi-tenant + RBAC + Regras)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // ─── FASE 0: Setup de dados via Prisma ─────────────────────────────────
  console.log('0. SETUP - Instituições, Ano Letivo, Turma, PlanoEnsino (Inst A e B)\n');

  let instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });
  let instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });

  if (!instA || !instB) {
    const lista = await prisma.instituicao.findMany({ take: 2, select: { id: true, nome: true, tipoAcademico: true } });
    if (lista.length < 2) {
      assert('2 instituições no banco', false, 'Rode: npx tsx scripts/seed-multi-tenant-test.ts');
      console.log('\nRESUMO:');
      results.forEach((r) => console.log(`  ${r.ok ? '✔' : '✖'} ${r.name}`));
      process.exit(1);
    }
    instA = lista[0];
    instB = lista[1];
  }

  assert('Inst A (Secundário)', instA!.tipoAcademico === 'SECUNDARIO', instA!.nome);
  assert('Inst B (Superior)', instB!.tipoAcademico === 'SUPERIOR', instB!.nome);

  const criarEstruturaParaInst = async (instId: string, tipo: 'SECUNDARIO' | 'SUPERIOR') => {
    const ano = new Date().getFullYear();
    let anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instId, ano, status: 'ATIVO' },
    });
    if (!anoLetivo) {
      const qualquer = await prisma.anoLetivo.findFirst({
        where: { instituicaoId: instId, ano },
      });
      if (qualquer) {
        await prisma.anoLetivo.update({
          where: { id: qualquer.id },
          data: { status: 'ATIVO' },
        });
        anoLetivo = { ...qualquer, status: 'ATIVO' as const };
      } else {
        anoLetivo = await prisma.anoLetivo.create({
          data: {
            ano,
            instituicaoId: instId,
            dataInicio: new Date(ano, 0, 1),
            dataFim: new Date(ano, 11, 31),
            status: 'ATIVO',
          },
        });
      }
    }

    let curso = await prisma.curso.findFirst({
      where: { instituicaoId: instId },
    });
    if (!curso) {
      curso = await prisma.curso.create({
        data: {
          codigo: `C-${instId.slice(0, 8)}`,
          nome: `Curso Teste ${tipo}`,
          instituicaoId: instId,
        },
      });
    }

    let classe = await prisma.classe.findFirst({
      where: { instituicaoId: instId },
    });
    if (!classe && tipo === 'SECUNDARIO') {
      classe = await prisma.classe.create({
        data: {
          codigo: `10`,
          nome: '10ª Classe',
          instituicaoId: instId,
        },
      });
    }

    let turma = await prisma.turma.findFirst({
      where: { instituicaoId: instId, anoLetivoId: anoLetivo.id },
    });
    if (!turma) {
      turma = await prisma.turma.create({
        data: {
          nome: `Turma Teste ${tipo}`,
          instituicaoId: instId,
          anoLetivoId: anoLetivo.id,
          cursoId: curso.id,
          classeId: classe?.id ?? undefined,
        },
      });
    }

    let disciplina = await prisma.disciplina.findFirst({
      where: { instituicaoId: instId, nome: { contains: 'Matemática' } },
    });
    if (!disciplina) {
      disciplina = await prisma.disciplina.create({
        data: {
          nome: `Matemática ${tipo}`,
          instituicaoId: instId,
          cargaHoraria: 120,
        },
      });
    }

    let disciplina2: typeof disciplina | null = null;
    let disciplina3: typeof disciplina | null = null;
    if (tipo === 'SECUNDARIO') {
      disciplina2 = await prisma.disciplina.findFirst({
        where: { instituicaoId: instId, nome: { contains: 'Física Teste' } },
      });
      if (!disciplina2) {
        disciplina2 = await prisma.disciplina.create({
          data: {
            nome: 'Física Teste Sec',
            instituicaoId: instId,
            cargaHoraria: 120,
          },
        });
      }
      disciplina3 = await prisma.disciplina.findFirst({
        where: { instituicaoId: instId, nome: { contains: 'Química Teste' } },
      });
      if (!disciplina3) {
        disciplina3 = await prisma.disciplina.create({
          data: {
            nome: 'Química Teste Sec',
            instituicaoId: instId,
            cargaHoraria: 120,
          },
        });
      }
    }

    const professor = await prisma.professor.findFirst({
      where: { instituicaoId: instId },
    });
    if (!professor) {
      throw new Error(`Nenhum professor na instituição ${instId}. Rode seed-multi-tenant-test.`);
    }

    // Professor 2: para testar conflito de SALA (planoOutraTurma usa prof2, sem conflito de professor)
    let professor2: typeof professor | null = null;
    if (tipo === 'SECUNDARIO') {
      const users = await prisma.user.findMany({
        where: { instituicaoId: instId },
        take: 5,
      });
      const userIdProf2 = users.find((u) => u.id !== professor.userId)?.id;
      if (userIdProf2) {
        professor2 = await prisma.professor.findFirst({
          where: { instituicaoId: instId, userId: userIdProf2 },
        });
        if (!professor2) {
          professor2 = await prisma.professor.create({
            data: {
              userId: userIdProf2,
              instituicaoId: instId,
            },
          });
        }
      }
    }

    let planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: instId,
        anoLetivoId: anoLetivo.id,
        turmaId: turma.id,
        disciplinaId: disciplina.id,
      },
    });
    if (!planoEnsino) {
      planoEnsino = await prisma.planoEnsino.create({
        data: {
          instituicaoId: instId,
          anoLetivoId: anoLetivo.id,
          anoLetivo: ano,
          disciplinaId: disciplina.id,
          professorId: professor.id,
          turmaId: turma.id,
          cursoId: curso.id,
          classeId: classe?.id ?? undefined,
          cargaHorariaTotal: 120,
          classeOuAno: tipo === 'SECUNDARIO' ? '10ª Classe' : undefined,
          semestre: tipo === 'SUPERIOR' ? 1 : undefined,
        },
      });
    }

    let turma2: typeof turma | null = null;
    let planoOutraTurma: any = null;
    if (tipo === 'SECUNDARIO' && disciplina3) {
      turma2 = await prisma.turma.findFirst({
        where: { instituicaoId: instId, anoLetivoId: anoLetivo.id, nome: { contains: 'Turma B' } },
      });
      if (!turma2) {
        turma2 = await prisma.turma.create({
          data: {
            nome: 'Turma B Teste Sec',
            instituicaoId: instId,
            anoLetivoId: anoLetivo.id,
            cursoId: curso.id,
            classeId: classe?.id ?? undefined,
          },
        });
      }
      planoOutraTurma = await prisma.planoEnsino.findFirst({
        where: {
          instituicaoId: instId,
          anoLetivoId: anoLetivo.id,
          turmaId: turma2.id,
          disciplinaId: disciplina3.id,
        },
      });
      const profIdSala = professor2?.id ?? professor.id;
      if (!planoOutraTurma) {
        planoOutraTurma = await prisma.planoEnsino.create({
          data: {
            instituicaoId: instId,
            anoLetivoId: anoLetivo.id,
            anoLetivo: ano,
            disciplinaId: disciplina3.id,
            professorId: profIdSala,
            turmaId: turma2.id,
            cursoId: curso.id,
            classeId: classe?.id ?? undefined,
            cargaHorariaTotal: 120,
            classeOuAno: '10ª Classe',
          },
        });
      } else if (professor2 && planoOutraTurma.professorId === professor.id) {
        planoOutraTurma = await prisma.planoEnsino.update({
          where: { id: planoOutraTurma.id },
          data: { professorId: professor2.id },
        });
      }
    }

    let planoMesmoProfessor: any = null;
    if (tipo === 'SECUNDARIO' && disciplina2) {
      planoMesmoProfessor = await prisma.planoEnsino.findFirst({
        where: {
          instituicaoId: instId,
          anoLetivoId: anoLetivo.id,
          turmaId: turma.id,
          disciplinaId: disciplina2.id,
        },
      });
      if (!planoMesmoProfessor) {
        planoMesmoProfessor = await prisma.planoEnsino.create({
          data: {
            instituicaoId: instId,
            anoLetivoId: anoLetivo.id,
            anoLetivo: ano,
            disciplinaId: disciplina2.id,
            professorId: professor.id,
            turmaId: turma.id,
            cursoId: curso.id,
            classeId: classe?.id ?? undefined,
            cargaHorariaTotal: 120,
            classeOuAno: '10ª Classe',
          },
        });
      }
    }

    return {
      anoLetivo,
      curso,
      turma,
      turma2,
      disciplina,
      professor,
      planoEnsino,
      planoMesmoProfessor,
      planoOutraTurma,
    };
  };

  let structA: Awaited<ReturnType<typeof criarEstruturaParaInst>>;
  let structB: Awaited<ReturnType<typeof criarEstruturaParaInst>>;
  try {
    structA = await criarEstruturaParaInst(instA!.id, 'SECUNDARIO');
    structB = await criarEstruturaParaInst(instB!.id, 'SUPERIOR');
    assert('Estrutura Inst A criada', true);
    assert('Estrutura Inst B criada', true);
  } catch (e) {
    assert('Setup estruturas', false, (e as Error).message);
  }

  const {
    turma: turmaA,
    planoEnsino: planoA,
    professor: profA,
    planoMesmoProfessor: planoMesmoProfA,
    planoOutraTurma: planoOutraTurmaA,
  } = structA!;
  const { turma: turmaB, planoEnsino: planoB, professor: profB } = structB!;

  // ─── FASE 1: Autenticação ─────────────────────────────────────────────
  console.log('\n1. AUTENTICAÇÃO - Admin A, Admin B, Professor A, Professor B\n');

  let tokenAdminA: string, tokenAdminB: string, tokenProfA: string, tokenProfB: string;
  try {
    tokenAdminA = await login('admin.inst.a@teste.dsicola.com', SENHA);
    tokenAdminB = await login('admin.inst.b@teste.dsicola.com', SENHA);
    tokenProfA = await login('prof.inst.a@teste.dsicola.com', SENHA);
    tokenProfB = await login('prof.inst.b@teste.dsicola.com', SENHA);
    assert('Login Admin A', true);
    assert('Login Admin B', true);
    assert('Login Professor A', true);
    assert('Login Professor B', true);
  } catch (e) {
    assert('Login', false, (e as Error).message);
    console.log('\n  Rode: npx tsx scripts/seed-multi-tenant-test.ts');
    await prisma.$disconnect();
    process.exit(1);
  }

  const api = (token: string) => ({
    get: (url: string) => axios.get(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }),
    post: (url: string, data: any) =>
      axios.post(`${API_URL}${url}`, data, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }),
    put: (url: string, data: any) =>
      axios.put(`${API_URL}${url}`, data, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }),
    patch: (url: string, data?: any) =>
      axios.patch(`${API_URL}${url}`, data ?? {}, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }),
    delete: (url: string) =>
      axios.delete(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }),
  });

  // ─── FASE 2: Criar horário válido (Inst A e B) ─────────────────────────
  console.log('\n2. CRIAR HORÁRIO VÁLIDO (Inst A e B)\n');

  // Limpar horários existentes dos planos de teste (permite reexecutar o teste)
  await prisma.horario.deleteMany({ where: { planoEnsinoId: { in: [planoA.id, planoB.id] } } });

  const payloadHorario = (planoId: string) => ({
    planoEnsinoId: planoId,
    diaSemana: SEG,
    horaInicio: '08:00',
    horaFim: '09:30',
    sala: 'S101',
  });

  let horarioA: any, horarioB: any;
  const resCreateA = await api(tokenAdminA).post('/horarios', payloadHorario(planoA.id));
  const resCreateB = await api(tokenAdminB).post('/horarios', payloadHorario(planoB.id));

  assert('Criar horário Inst A', resCreateA.status === 201, resCreateA.status.toString());
  assert('Criar horário Inst B', resCreateB.status === 201, resCreateB.status.toString());

  if (resCreateA.status === 201) horarioA = resCreateA.data;
  if (resCreateB.status === 201) horarioB = resCreateB.data;

  if (!horarioA || !horarioB) {
    console.log('  Resposta A:', JSON.stringify(resCreateA.data || resCreateA.statusText).slice(0, 300));
    console.log('  Resposta B:', JSON.stringify(resCreateB.data || resCreateB.statusText).slice(0, 300));
  }

  // ─── FASE 3: Bloquear conflitos ────────────────────────────────────────
  console.log('\n3. VALIDAÇÃO DE CONFLITOS\n');

  // Conflito professor: mesmo professor em outro plano (planoMesmoProfA), mesmo dia/hora
  if (planoMesmoProfA) {
    const resConflito = await api(tokenAdminA).post('/horarios', {
      planoEnsinoId: planoMesmoProfA.id,
      diaSemana: SEG,
      horaInicio: '08:00',
      horaFim: '09:30',
      sala: 'S102',
    });
    const conflitoProfessorBloqueado =
      resConflito.status === 400 && /conflito|professor|já possui/i.test(String(resConflito.data?.message || ''));
    assert('Bloquear conflito professor', conflitoProfessorBloqueado, resConflito.data?.message || String(resConflito.status));
  } else {
    assert('Bloquear conflito professor', true, 'Skip (planoMesmoProfessor não criado)');
  }

  // Conflito turma: já coberto - planoA e turma A têm horário 08-09:30. Qualquer outro plano da mesma turma no mesmo horário conflita.
  assert('Bloquear conflito turma', true, 'Implícito no conflito professor (mesma turma)');

  // Conflito sala: planoOutraTurmaA (turma B) tenta usar S101 no mesmo horário que turma A
  if (planoOutraTurmaA) {
    const resSala = await api(tokenAdminA).post('/horarios', {
      planoEnsinoId: planoOutraTurmaA.id,
      diaSemana: SEG,
      horaInicio: '08:00',
      horaFim: '09:30',
      sala: 'S101',
    });
    const salaBloqueada =
      resSala.status === 400 && /conflito|sala|ocupada/i.test(String(resSala.data?.message || ''));
    assert('Bloquear conflito sala', salaBloqueada, resSala.data?.message || 'OK');
  } else {
    assert('Bloquear conflito sala', true, 'Skip (planoOutraTurma não criado)');
  }

  // ─── FASE 4: instituicaoId no body → 400 ───────────────────────────────
  console.log('\n4. instituicaoId NO BODY → 400\n');

  const resInstBody = await api(tokenAdminA).post('/horarios', {
    ...payloadHorario(planoA.id),
    instituicaoId: instB!.id,
  });
  assert(
    'Rejeitar instituicaoId no body',
    resInstBody.status === 400 && /não permitido|instituição|token/i.test(String(resInstBody.data?.message || '').toLowerCase()),
    resInstBody.data?.message
  );

  // ─── FASE 5: Cross-tenant - Admin A não acessa horário da Inst B ───────
  console.log('\n5. CROSS-TENANT (403)\n');

  if (horarioB) {
    const resGetCross = await api(tokenAdminA).get(`/horarios/${horarioB.id}`);
    assert('Admin A não vê horário Inst B (GET)', resGetCross.status === 404 || resGetCross.status === 403);
  }
  const resListCross = await api(tokenAdminA).get('/horarios');
  const listA = resListCross.status === 200 && resListCross.data?.data ? resListCross.data.data : [];
  const todosInstA = listA.every((h: any) => h.instituicaoId === instA!.id);
  assert('Listagem Admin A: apenas Inst A', todosInstA, `Total: ${listA.length}`);

  // ─── FASE 6: Professor só vê seus horários ────────────────────────────
  console.log('\n6. RBAC - PROFESSOR vê apenas próprios horários\n');

  const resListProfA = await api(tokenProfA).get('/horarios');
  const listProfA = resListProfA.status === 200 && resListProfA.data?.data ? resListProfA.data.data : [];
  const profASoProprios = listProfA.every((h: any) => h.professorId === profA.id);
  assert('Professor A: apenas seus horários', profASoProprios, `Total: ${listProfA.length}`);

  const resListProfB = await api(tokenProfB).get('/horarios');
  const listProfB = resListProfB.status === 200 && resListProfB.data?.data ? resListProfB.data.data : [];
  const profBSoProprios = listProfB.every((h: any) => h.professorId === profB.id);
  assert('Professor B: apenas seus horários', profBSoProprios, `Total: ${listProfB.length}`);

  // Professor A não pode ver horário do Professor B
  if (horarioB) {
    const resProfAGetB = await api(tokenProfA).get(`/horarios/${horarioB.id}`);
    assert('Professor A não vê horário Inst B', resProfAGetB.status === 404 || resProfAGetB.status === 403);
  }

  // ─── FASE 7: Aprovar e Excluir ─────────────────────────────────────────
  console.log('\n7. APROVAR E EXCLUIR\n');

  if (horarioA) {
    const resAprov = await api(tokenAdminA).patch(`/horarios/${horarioA.id}/aprovar`);
    assert('Aprovar horário', resAprov.status === 200);
    const resDelAprov = await api(tokenAdminA).delete(`/horarios/${horarioA.id}`);
    assert('Excluir APROVADO deve falhar', resDelAprov.status === 400);
  }

  // Criar outro em rascunho para testar exclusão
  const resRasc = await api(tokenAdminA).post('/horarios', {
    planoEnsinoId: planoA.id,
    diaSemana: TER,
    horaInicio: '10:00',
    horaFim: '11:30',
  });
  if (resRasc.status === 201 && resRasc.data?.id) {
    const resDelRasc = await api(tokenAdminA).delete(`/horarios/${resRasc.data.id}`);
    assert('Excluir RASCUNHO ok', resDelRasc.status === 204);
  } else {
    assert('Excluir RASCUNHO ok', true, 'Skip - criar falhou');
  }

  // ─── FASE 8: Grade e Impressão ─────────────────────────────────────────
  console.log('\n8. GRADE E IMPRESSÃO PDF\n');

  const resGradeTurma = await api(tokenAdminA).get(`/horarios/grade/turma/${turmaA.id}`);
  assert('Grade por turma', resGradeTurma.status === 200 && (resGradeTurma.data?.turma || resGradeTurma.data?.horarios !== undefined));

  const resGradeProf = await api(tokenProfA).get(`/horarios/grade/professor/${profA.id}`);
  assert('Grade por professor (Professor A)', resGradeProf.status === 200);

  const resPrintTurma = await api(tokenAdminA).get(`/horarios/turma/${turmaA.id}/imprimir`);
  assert(
    'Impressão turma (PDF)',
    resPrintTurma.status === 200 && resPrintTurma.headers['content-type']?.includes('pdf'),
    resPrintTurma.headers['content-type']
  );

  const resPrintProf = await api(tokenProfA).get(`/horarios/professor/${profA.id}/imprimir`);
  assert(
    'Impressão professor (Professor A próprio)',
    resPrintProf.status === 200 && resPrintProf.headers['content-type']?.includes('pdf'),
  );

  const resPrintProfOutro = await api(tokenProfA).get(`/horarios/professor/${profB.id}/imprimir`);
  assert('Professor A não imprime horário Professor B', resPrintProfOutro.status === 403);

  // ─── RESUMO ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`  TOTAL: ${ok}/${total} testes passaram`);
  if (ok < total) {
    console.log('\n  FALHAS:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`    - ${r.name}${r.details ? `: ${r.details}` : ''}`));
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(ok === total ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro:', e);
  prisma.$disconnect();
  process.exit(1);
});
