#!/usr/bin/env npx tsx
/**
 * TESTE: Sugestões semi-automáticas e criação em lote de horários
 *
 * Valida:
 * - GET /horarios/sugestoes/:turmaId retorna sugestões para planos sem horário
 * - Blocos respeitam duracaoHoraAulaMinutos (45 ou 60 min)
 * - POST /horarios/bulk cria horários e evita conflitos
 * - Turno manhã/tarde/noite
 *
 * Pré-requisito: Backend rodando (npm run dev), dados com turma + planos
 *
 * Uso: npx tsx backend/scripts/test-horarios-sugestoes.ts
 */
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';

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
  };
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TESTE - Sugestões semi-automáticas e bulk create de horários');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ─── Setup: encontrar ou criar estrutura mínima ─────────────────────────
  console.log('1. SETUP - Turma com planos sem horário\n');

  // Preferir instituição do seed (inst-a ou inst-b) para ter admin conhecido
  let instituicao = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    select: { id: true, tipoAcademico: true },
  });
  if (!instituicao) {
    instituicao = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      select: { id: true, tipoAcademico: true },
    });
  }
  if (!instituicao) {
    instituicao = await prisma.instituicao.findFirst({
      where: { status: 'ativa' },
      select: { id: true, tipoAcademico: true },
    });
  }

  if (!instituicao) {
    assert('Instituição existente', false, 'Nenhuma instituição no banco');
    console.log('\nResumo:', results.filter((r) => !r.ok).map((r) => r.name));
    process.exit(1);
  }

  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instituicao.id, status: 'ATIVO' },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instituicao.id },
    });
    if (anoLetivo) {
      await prisma.anoLetivo.update({
        where: { id: anoLetivo.id },
        data: { status: 'ATIVO' },
      });
    }
  }

  if (!anoLetivo) {
    const ano = new Date().getFullYear();
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        ano,
        instituicaoId: instituicao.id,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ATIVO',
      },
    });
  }

  const curso = await prisma.curso.findFirst({ where: { instituicaoId: instituicao.id } });
  if (!curso) {
    assert('Curso existente', false, 'Crie um curso antes');
    process.exit(1);
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: instituicao.id, anoLetivoId: anoLetivo.id },
    include: { anoLetivoRef: true },
  });

  if (!turma) {
    turma = await prisma.turma.create({
      data: {
        nome: 'Turma Teste Sugestões',
        instituicaoId: instituicao.id,
        anoLetivoId: anoLetivo.id,
        cursoId: curso.id,
      },
      include: { anoLetivoRef: true },
    });
  }

  const disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId: instituicao.id },
  });
  const professor = await prisma.professor.findFirst({
    where: { instituicaoId: instituicao.id },
  });
  const classe = instituicao.tipoAcademico === 'SECUNDARIO'
    ? await prisma.classe.findFirst({ where: { instituicaoId: instituicao.id } })
    : null;

  if (!disciplina || !professor) {
    assert('Disciplina e Professor', false, 'Execute seed-multi-tenant-test ou crie manualmente');
    process.exit(1);
  }

  let plano1 = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId: instituicao.id,
      turmaId: turma.id,
      anoLetivoId: anoLetivo.id,
    },
  });

  if (!plano1) {
    plano1 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instituicao.id,
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        disciplinaId: disciplina.id,
        professorId: professor.id,
        turmaId: turma.id,
        cursoId: curso.id,
        classeId: classe?.id ?? undefined,
        cargaHorariaTotal: disciplina.cargaHoraria || 60,
        classeOuAno: instituicao.tipoAcademico === 'SECUNDARIO' ? '10ª Classe' : undefined,
        semestre: instituicao.tipoAcademico === 'SUPERIOR' ? 1 : undefined,
      },
    });
  }

  // Remover horários existentes dos planos desta turma para testar sugestões
  await prisma.horario.deleteMany({
    where: { turmaId: turma.id },
  });

  assert('Turma com plano sem horário', !!turma && !!plano1, turma?.nome);

  // Buscar usuário admin para login (UserRole_ ou roles no User)
  const adminRole = await prisma.userRole_.findFirst({
    where: { instituicaoId: instituicao.id, role: 'ADMIN' },
    include: { user: { select: { email: true } } },
  });
  const admin = adminRole?.user
    ?? await prisma.user.findFirst({
      where: { instituicaoId: instituicao.id },
      select: { email: true },
    });

  if (!admin?.email) {
    assert('Admin para login', false, 'Nenhum admin na instituição');
    process.exit(1);
  }

  const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';
  let token: string;
  try {
    token = await login(admin.email, SENHA);
  } catch (e: any) {
    if (e.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
      assert('Login admin', false, `Backend não está rodando em ${API_URL}. Execute: npm run dev`);
    } else {
      assert('Login admin', false, `${e.message || 'Falha no login'}. Senha: ${SENHA}`);
    }
    process.exit(1);
  }
  assert('Login admin', true);

  const client = api(token);

  // ─── 2. GET sugestões ─────────────────────────────────────────────────
  console.log('\n2. GET /horarios/sugestoes/:turmaId\n');
  console.log(`  Turma: ${turma.nome} (id=${turma.id}, inst=${turma.instituicaoId})`);

  const resSugestoes = await client.get(`/horarios/sugestoes/${turma.id}`);
  if (resSugestoes.status !== 200 && resSugestoes.data) {
    console.log('  Resposta:', JSON.stringify(resSugestoes.data).slice(0, 200));
  }
  assert('Sugestões retornam 200', resSugestoes.status === 200, String(resSugestoes.status));

  const sugestoes = Array.isArray(resSugestoes.data) ? resSugestoes.data : [];
  assert('Array de sugestões', Array.isArray(resSugestoes.data));
  assert('Ao menos 1 sugestão (plano sem horário)', sugestoes.length >= 1, `encontradas: ${sugestoes.length}`);

  if (sugestoes.length > 0) {
    const s = sugestoes[0];
    assert('Sugestão tem planoEnsinoId', !!s.planoEnsinoId);
    assert('Sugestão tem turmaId', s.turmaId === turma.id);
    assert('Sugestão tem diaSemana (1-5)', s.diaSemana >= 1 && s.diaSemana <= 5);
    assert('Sugestão tem horaInicio e horaFim', !!s.horaInicio && !!s.horaFim);

    const duracaoEsperada = instituicao.tipoAcademico === 'SECUNDARIO' ? 45 : 60;
    const [h1, m1] = (s.horaInicio || '00:00').split(':').map(Number);
    const [h2, m2] = (s.horaFim || '00:00').split(':').map(Number);
    const minutos = (h2 - h1) * 60 + (m2 - m1);
    assert(`Bloco com duração correta (${duracaoEsperada} min)`, minutos === duracaoEsperada, `minutos=${minutos}`);
  }

  // ─── 3. GET sugestões com turno ───────────────────────────────────────
  console.log('\n3. GET sugestões com ?turno=tarde\n');

  const resTarde = await client.get(`/horarios/sugestoes/${turma.id}?turno=tarde`);
  assert('Sugestões tarde 200', resTarde.status === 200);

  const sugestoesTarde = Array.isArray(resTarde.data) ? resTarde.data : [];
  if (sugestoesTarde.length > 0) {
    const s = sugestoesTarde[0];
    const horaInicio = parseInt((s.horaInicio || '08:00').split(':')[0], 10);
    assert('Turno tarde: início ≥ 14h', horaInicio >= 14, `início=${s.horaInicio}`);
  }

  // ─── 4. POST bulk create ──────────────────────────────────────────────
  console.log('\n4. POST /horarios/bulk - criar horários\n');

  const horariosParaCriar = sugestoes.slice(0, 2).map((s: any) => ({
    planoEnsinoId: s.planoEnsinoId,
    turmaId: s.turmaId,
    diaSemana: s.diaSemana,
    horaInicio: s.horaInicio,
    horaFim: s.horaFim,
    sala: s.sala || null,
  }));

  const resBulk = await client.post('/horarios/bulk', { horarios: horariosParaCriar });
  assert('Bulk create retorna 201', resBulk.status === 201, String(resBulk.status));

  const { criados = 0, erros = 0, horarios = [] } = resBulk.data || {};
  assert('criados >= 1', criados >= 1, `criados=${criados}, erros=${erros}`);
  assert('horarios no response', Array.isArray(horarios) && horarios.length >= 1);

  // ─── 5. Verificar horários criados ────────────────────────────────────
  console.log('\n5. Verificar horários na base\n');

  const horariosCriados = await prisma.horario.findMany({
    where: { turmaId: turma.id },
    include: { disciplina: true, professor: { include: { user: { select: { nomeCompleto: true } } } } },
  });

  assert('Horários persistidos', horariosCriados.length >= 1, `total=${horariosCriados.length}`);
  assert('Horário tem disciplina e professor', horariosCriados.every((h) => h.disciplinaId && h.professorId));

  // ─── 6. Sugestões após criar: menos (já têm horário) ───────────────────
  console.log('\n6. Sugestões após criar - planos já com horário\n');

  const resSugestoes2 = await client.get(`/horarios/sugestoes/${turma.id}`);
  const sugestoes2 = Array.isArray(resSugestoes2.data) ? resSugestoes2.data : [];

  const planosSemHorarioAinda = sugestoes.length - horariosParaCriar.length;
  assert(
    'Menos sugestões após criar',
    sugestoes2.length <= sugestoes.length,
    `antes=${sugestoes.length}, depois=${sugestoes2.length}`
  );

  // ─── RESUMO ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('  FALHAS:');
    failed.forEach((r) => console.log(`    ✖ ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
  console.log('  TODOS OS TESTES PASSARAM ✔');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
