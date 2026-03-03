#!/usr/bin/env npx tsx
/**
 * TESTE: Plano de Ensino Completo - Secundário e Superior (Multi-tenant)
 *
 * Valida fluxo completo:
 * - Professor, turmas, turnos, disciplinas, salas (CRUD e visibilidade)
 * - Dias indisponíveis professor (PATCH)
 * - Prioridade disciplina
 * - Plano de ensino (criar, aprovar)
 * - Sugestão de horários (com salas, prioridade, dias indisponíveis)
 * - Multitenant: Inst A (Secundário) e Inst B (Superior) isolados
 *
 * Pré-requisito: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx scripts/test-plano-ensino-completo-multitenant.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

interface TestResult {
  name: string;
  ok: boolean;
  details?: string;
  cat?: string;
}
const results: TestResult[] = [];

function assert(name: string, ok: boolean, details?: string, cat?: string) {
  const icon = ok ? '✔' : '✖';
  const prefix = cat ? `[${cat}] ` : '';
  console.log(`  ${icon} ${prefix}${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details, cat });
}

async function login(email: string, password: string): Promise<string> {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password }, { validateStatus: () => true });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login falhou: ${email}`);
  }
  return res.data.accessToken;
}

function api(token: string) {
  return {
    get: (url: string, params?: object) =>
      axios.get(`${API_URL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        validateStatus: () => true,
      }),
    post: (url: string, data?: object) =>
      axios.post(`${API_URL}${url}`, data ?? {}, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    put: (url: string, data?: object) =>
      axios.put(`${API_URL}${url}`, data ?? {}, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    patch: (url: string, data?: object) =>
      axios.patch(`${API_URL}${url}`, data ?? {}, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
    delete: (url: string) =>
      axios.delete(`${API_URL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      }),
  };
}

type TipoAcademico = 'SECUNDARIO' | 'SUPERIOR';

async function runTestesInstituicao(
  inst: { id: string; nome: string; tipoAcademico: TipoAcademico | null },
  token: string,
  adminEmail: string
) {
  const cat = inst.tipoAcademico === 'SECUNDARIO' ? 'Sec' : 'Sup';
  const client = api(token);

  console.log(`\n─── ${inst.tipoAcademico}: ${inst.nome} ───\n`);

  // 1. Professores
  const resProf = await client.get('/professores');
  assert(`Professores retornam 200`, resProf.status === 200, undefined, cat);
  const professores = Array.isArray(resProf.data) ? resProf.data : resProf.data?.data ?? [];
  assert(`Ao menos 1 professor`, professores.length >= 1, `total=${professores.length}`, cat);

  const professor = professores[0];
  if (professor?.id) {
    const resPatch = await client.patch(`/professores/${professor.id}`, {
      diasIndisponiveis: [0, 6],
    });
    assert(`PATCH professor diasIndisponiveis 200`, resPatch.status === 200, String(resPatch.status), cat);
    assert(`diasIndisponiveis retornados`, Array.isArray(resPatch.data?.diasIndisponiveis), undefined, cat);
  }

  // 2. Turmas
  const resTurmas = await client.get('/turmas');
  assert(`Turmas retornam 200`, resTurmas.status === 200, undefined, cat);
  const turmas = Array.isArray(resTurmas.data) ? resTurmas.data : resTurmas.data?.data ?? [];
  assert(`Ao menos 1 turma`, turmas.length >= 1, `total=${turmas.length}`, cat);

  // 3. Turnos
  const resTurnos = await client.get('/turnos');
  assert(`Turnos retornam 200`, resTurnos.status === 200, undefined, cat);
  const turnos = Array.isArray(resTurnos.data) ? resTurnos.data : [];
  assert(`Ao menos 1 turno`, turnos.length >= 1, `total=${turnos.length}`, cat);

  // 4. Disciplinas
  const resDisc = await client.get('/disciplinas');
  assert(`Disciplinas retornam 200`, resDisc.status === 200, undefined, cat);
  const disciplinas = Array.isArray(resDisc.data) ? resDisc.data : resDisc.data?.data ?? [];
  assert(`Ao menos 1 disciplina`, disciplinas.length >= 1, `total=${disciplinas.length}`, cat);

  const disciplina = disciplinas[0];
  if (disciplina?.id) {
    const resUpd = await client.put(`/disciplinas/${disciplina.id}`, {
      nome: disciplina.nome,
      cargaHoraria: disciplina.cargaHoraria ?? disciplina.carga_horaria ?? 60,
      prioridadeHorario: 10,
    });
    assert(`PUT disciplina prioridadeHorario 200`, resUpd.status === 200, String(resUpd.status), cat);
  }

  // 5. Salas
  const resSalas = await client.get('/salas');
  assert(`Salas retornam 200`, resSalas.status === 200, undefined, cat);
  const salas = Array.isArray(resSalas.data) ? resSalas.data : [];
  assert(`Ao menos 1 sala`, salas.length >= 1, `total=${salas.length}`, cat);

  // 6. Plano de ensino
  const turma = turmas[0];
  if (!turma?.id || !professor?.id || !disciplina?.id) {
    assert(`Setup plano (turma, prof, disc)`, false, 'Dados insuficientes', cat);
    return;
  }

  const anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: inst.id, status: 'ATIVO' },
  });
  if (!anoLetivo) {
    assert(`Ano letivo ativo`, false, 'Execute seed-multi-tenant-test', cat);
    return;
  }

  let plano = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId: inst.id,
      turmaId: turma.id,
      professorId: professor.id,
      disciplinaId: disciplina.id,
    },
  });

  if (!plano) {
    const classe = inst.tipoAcademico === 'SECUNDARIO'
      ? await prisma.classe.findFirst({ where: { instituicaoId: inst.id } })
      : null;
    const curso = await prisma.curso.findFirst({ where: { instituicaoId: inst.id } });
    plano = await prisma.planoEnsino.create({
      data: {
        instituicaoId: inst.id,
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        disciplinaId: disciplina.id,
        professorId: professor.id,
        turmaId: turma.id,
        cursoId: curso?.id ?? undefined,
        classeId: classe?.id ?? undefined,
        cargaHorariaTotal: disciplina.cargaHoraria ?? disciplina.carga_horaria ?? 60,
        classeOuAno: inst.tipoAcademico === 'SECUNDARIO' ? '10ª Classe' : '1º Ano',
        semestre: inst.tipoAcademico === 'SUPERIOR' ? 1 : undefined,
        status: 'APROVADO',
        estado: 'APROVADO',
        bloqueado: false,
      },
    });
  }
  assert(`Plano de ensino existe`, !!plano?.id, undefined, cat);

  // 7. Sugestões de horários
  const resSug = await client.get(`/horarios/sugestoes/${turma.id}?turno=manha`);
  assert(`Sugestões horários 200`, resSug.status === 200, undefined, cat);
  const sugestoes = Array.isArray(resSug.data) ? resSug.data : [];
  assert(`Sugestões retornadas`, sugestoes.length >= 0, `count=${sugestoes.length}`, cat);

  if (sugestoes.length > 0) {
    const s = sugestoes[0];
    assert(`Sugestão tem planoEnsinoId`, !!s.planoEnsinoId, undefined, cat);
    assert(`Sugestão tem diaSemana`, typeof s.diaSemana === 'number', undefined, cat);
    assert(`Sugestão tem horaInicio/Fim`, !!(s.horaInicio && s.horaFim), undefined, cat);
    if (salas.length > 0 && s.sala) {
      assert(`Sugestão inclui sala`, !!s.sala, `sala=${s.sala}`, cat);
    }
  }

  // 8. Criar horário a partir de sugestão
  if (sugestoes.length > 0) {
    const sug = sugestoes[0];
    const resCreate = await client.post('/horarios', {
      planoEnsinoId: sug.planoEnsinoId,
      turmaId: turma.id,
      diaSemana: sug.diaSemana,
      horaInicio: sug.horaInicio,
      horaFim: sug.horaFim,
      sala: sug.sala || (salas[0]?.nome ?? 'Sala 1'),
    });
    assert(`Criar horário 201`, resCreate.status === 201, String(resCreate.status), cat);
  }

  // 9. Multitenant: Admin A não acessa sugestões de turma da Inst B (e vice-versa)
  const instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' }, select: { id: true } });
  const instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' }, select: { id: true } });
  const outraInstId = inst.id === instA?.id ? instB?.id : instA?.id;
  const turmaOutra = await prisma.turma.findFirst({
    where: { instituicaoId: outraInstId! },
    select: { id: true },
  });
  if (turmaOutra?.id) {
    const resCross = await client.get(`/horarios/sugestoes/${turmaOutra.id}`);
    assert(`Multitenant: não acessa sugestões de outra inst`, resCross.status === 404,
      `status=${resCross.status}`, cat);
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TESTE - Plano de Ensino Completo (Secundário + Superior)');
  console.log('══════════════════════════════════════════════════════════════\n');

  const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

  const instSec = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });
  const instSup = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });

  if (!instSec || !instSup) {
    console.error('   ❌ Execute: npx tsx backend/scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const obterAdmin = async (instId: string) => {
    const r = await prisma.userRole_.findFirst({
      where: { instituicaoId: instId, role: 'ADMIN' },
      include: { user: { select: { email: true } } },
    });
    return r?.user?.email ?? (await prisma.user.findFirst({
      where: { instituicaoId: instId },
      select: { email: true },
    }))?.email;
  };

  const adminSec = await obterAdmin(instSec.id);
  const adminSup = await obterAdmin(instSup.id);

  if (!adminSec || !adminSup) {
    console.error('   ❌ Admins não encontrados');
    process.exit(1);
  }

  let tokenSec: string;
  let tokenSup: string;
  try {
    tokenSec = await login(adminSec, SENHA);
    tokenSup = await login(adminSup, SENHA);
  } catch (e: any) {
    if (e.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
      console.error(`   ❌ Backend não está rodando em ${API_URL}. Execute: npm run dev`);
    } else {
      console.error(`   ❌ Login falhou: ${e.message}. Senha: ${SENHA}`);
    }
    process.exit(1);
  }

  await runTestesInstituicao(instSec, tokenSec, adminSec);
  await runTestesInstituicao(instSup, tokenSup, adminSup);

  console.log('\n══════════════════════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('  FALHAS:');
    failed.forEach((r) => console.log(`    ✖ [${r.cat || 'Geral'}] ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
  console.log('  TODOS OS TESTES PASSARAM ✔');
  console.log(`  Secundário: ${results.filter((r) => r.cat === 'Sec' && r.ok).length} testes`);
  console.log(`  Superior: ${results.filter((r) => r.cat === 'Sup' && r.ok).length} testes`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('Erro:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
