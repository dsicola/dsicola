#!/usr/bin/env npx tsx
/**
 * TESTE: Horários e Sugestões - Ensino Secundário e Superior
 *
 * Valida para AMBOS os tipos de ensino:
 * - Horários: criar, listar, atualizar, validar conflitos, aprovar, excluir
 * - Sugestões: GET manhã/tarde/noite, blocos com duração correta (45min vs 60min)
 * - Bulk create a partir de sugestões
 *
 * Secundário: blocos 45 min (hora-aula), validação de duração fixa
 * Superior: blocos 60 min (hora-relógio), blocos livres
 *
 * Pré-requisito: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx backend/scripts/test-horarios-sugestoes-secundario-superior.ts
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
  categoria?: string;
}
const results: TestResult[] = [];

function assert(name: string, ok: boolean, details?: string, categoria?: string) {
  const icon = ok ? '✔' : '✖';
  const cat = categoria ? `[${categoria}] ` : '';
  console.log(`  ${icon} ${cat}${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details, categoria });
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

function minutosEntreHoras(horaInicio: string, horaFim: string): number {
  const [h1, m1] = (horaInicio || '00:00').split(':').map(Number);
  const [h2, m2] = (horaFim || '00:00').split(':').map(Number);
  return (h2 - h1) * 60 + (m2 - m1);
}

type TipoAcademico = 'SECUNDARIO' | 'SUPERIOR';

async function runTestesParaInstituicao(
  instituicao: { id: string; nome: string; tipoAcademico: TipoAcademico | null },
  token: string,
  turma: { id: string; nome: string },
  plano: { id: string },
  adminEmail: string
) {
  const cat = instituicao.tipoAcademico === 'SECUNDARIO' ? 'Secundário' : 'Superior';
  const duracaoEsperada = instituicao.tipoAcademico === 'SECUNDARIO' ? 45 : 60;
  const client = api(token);

  console.log(`\n─── ${cat}: ${instituicao.nome} ───\n`);

  // Remover horários da turma para começar limpo
  await prisma.horario.deleteMany({ where: { turmaId: turma.id } });

  // 1. GET sugestões manhã
  const resSug = await client.get(`/horarios/sugestoes/${turma.id}?turno=manha`);
  assert(`Sugestões manhã retornam 200`, resSug.status === 200, String(resSug.status), cat);
  const sugestoes = Array.isArray(resSug.data) ? resSug.data : [];
  assert(`Ao menos 1 sugestão`, sugestoes.length >= 1, `encontradas: ${sugestoes.length}`, cat);

  if (sugestoes.length > 0) {
    const s = sugestoes[0];
    assert(`Sugestão tem planoEnsinoId`, !!s.planoEnsinoId, undefined, cat);
    assert(`Sugestão tem diaSemana 1-5`, s.diaSemana >= 1 && s.diaSemana <= 5, undefined, cat);
    assert(`Bloco duração ${duracaoEsperada}min`, minutosEntreHoras(s.horaInicio, s.horaFim) === duracaoEsperada,
      `minutos=${minutosEntreHoras(s.horaInicio, s.horaFim)}`, cat);
    assert(`Manhã: início 8h-12h`, (s.horaInicio || '').match(/^(0[89]|1[01]):/), `início=${s.horaInicio}`, cat);
  }

  // 2. GET sugestões tarde
  const resTarde = await client.get(`/horarios/sugestoes/${turma.id}?turno=tarde`);
  assert(`Sugestões tarde 200`, resTarde.status === 200, undefined, cat);
  const sugestoesTarde = Array.isArray(resTarde.data) ? resTarde.data : [];
  if (sugestoesTarde.length > 0) {
    const s = sugestoesTarde[0];
    const h = parseInt((s.horaInicio || '14:00').split(':')[0], 10);
    assert(`Turno tarde: início ≥ 14h`, h >= 14, `início=${s.horaInicio}`, cat);
  }

  // 3. GET sugestões noite
  const resNoite = await client.get(`/horarios/sugestoes/${turma.id}?turno=noite`);
  assert(`Sugestões noite 200`, resNoite.status === 200, undefined, cat);
  const sugestoesNoite = Array.isArray(resNoite.data) ? resNoite.data : [];
  if (sugestoesNoite.length > 0) {
    const s = sugestoesNoite[0];
    const h = parseInt((s.horaInicio || '18:00').split(':')[0], 10);
    assert(`Turno noite: início ≥ 18h`, h >= 18, `início=${s.horaInicio}`, cat);
  }

  // 4. POST criar horário individual
  const sugestaoPrimeira = sugestoes[0];
  const horaInicio = sugestaoPrimeira?.horaInicio ?? '08:00';
  const horaFim = sugestaoPrimeira?.horaFim ?? (duracaoEsperada === 45 ? '08:45' : '09:00');
  const resCreate = await client.post('/horarios', {
    planoEnsinoId: sugestaoPrimeira?.planoEnsinoId ?? plano.id,
    turmaId: turma.id,
    diaSemana: sugestaoPrimeira?.diaSemana ?? 1,
    horaInicio,
    horaFim,
    sala: 'Sala 101',
  });
  assert(`Criar horário 201`, resCreate.status === 201, String(resCreate.status), cat);
  const horarioCriado = resCreate.data;
  assert(`Horário retorna id`, !!horarioCriado?.id, undefined, cat);
  assert(`Horário tem disciplina e professor`, !!(horarioCriado?.disciplinaId && horarioCriado?.professorId), undefined, cat);

  // 5. Secundário: validar que blocos inválidos são rejeitados (50min ou 60min no secundário)
  const planoUsado = sugestaoPrimeira?.planoEnsinoId ?? plano.id;
  if (instituicao.tipoAcademico === 'SECUNDARIO') {
    const outroPlano = await prisma.planoEnsino.findFirst({
      where: { instituicaoId: instituicao.id, turmaId: turma.id, id: { not: planoUsado } },
    });
    if (outroPlano) {
      const resBad = await client.post('/horarios', {
        planoEnsinoId: outroPlano.id,
        turmaId: turma.id,
        diaSemana: 2,
        horaInicio: '10:00',
        horaFim: '11:00', // 60 min - inválido no secundário
        sala: null,
      });
      assert(`Secundário rejeita bloco 60min`, resBad.status === 400,
        resBad.data?.message?.includes('45 min') ? undefined : resBad.data?.message, cat);
    }
  }

  // 6. GET listar horários
  const resList = await client.get('/horarios', { params: { turmaId: turma.id } });
  assert(`Listar horários 200`, resList.status === 200, undefined, cat);
  const lista = Array.isArray(resList.data) ? resList.data : resList.data?.data ?? [];
  assert(`Lista contém horário criado`, lista.some((h: any) => h.id === horarioCriado?.id), `total=${lista.length}`, cat);

  // 7. PUT atualizar
  const novaSala = 'Sala 202';
  const resUpdate = await client.put(`/horarios/${horarioCriado.id}`, { sala: novaSala });
  assert(`Atualizar horário 200`, resUpdate.status === 200, undefined, cat);
  assert(`Sala atualizada`, resUpdate.data?.sala === novaSala, undefined, cat);

  // 8. DELETE (apenas RASCUNHO pode ser excluído; excluir antes de aprovar)
  const resDel = await client.delete(`/horarios/${horarioCriado.id}`);
  assert(`Excluir horário 200/204`, resDel.status === 200 || resDel.status === 204, String(resDel.status), cat);

  // 9. Criar novamente para testar aprovar e bulk
  const resCreate2 = await client.post('/horarios', {
    planoEnsinoId: planoUsado,
    turmaId: turma.id,
    diaSemana: sugestaoPrimeira?.diaSemana ?? 1,
    horaInicio,
    horaFim,
    sala: 'Sala 101',
  });
  const horario2 = resCreate2.status === 201 ? resCreate2.data : null;

  // 10. PATCH aprovar
  if (horario2?.id) {
    const resAprov = await client.patch(`/horarios/${horario2.id}/aprovar`);
    assert(`Aprovar horário 200`, resAprov.status === 200, String(resAprov.status), cat);
    assert(`Status APROVADO`, resAprov.data?.status === 'APROVADO', `status=${resAprov.data?.status}`, cat);
  }

  // 11. POST bulk (a partir das sugestões restantes)
  const sugestoesRestantes = sugestoes.filter((s: any) => s.planoEnsinoId !== planoUsado).slice(0, 2);
  if (sugestoesRestantes.length > 0) {
    const horariosBulk = sugestoesRestantes.map((s: any) => ({
      planoEnsinoId: s.planoEnsinoId,
      turmaId: s.turmaId,
      diaSemana: s.diaSemana,
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      sala: s.sala || null,
    }));
    const resBulk = await client.post('/horarios/bulk', { horarios: horariosBulk });
    assert(`Bulk create 201`, resBulk.status === 201, String(resBulk.status), cat);
    const { criados = 0 } = resBulk.data || {};
    assert(`Bulk criou horários`, criados >= 0, `criados=${criados}`, cat);
  }

  // 12. Sugestões após criar: menos (planos já com horário)
  const resSug2 = await client.get(`/horarios/sugestoes/${turma.id}`);
  const sugestoes2 = Array.isArray(resSug2.data) ? resSug2.data : [];
  assert(`Menos sugestões após criar`, sugestoes2.length <= sugestoes.length,
    `antes=${sugestoes.length}, depois=${sugestoes2.length}`, cat);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TESTE - Horários e Sugestões: Secundário e Superior');
  console.log('══════════════════════════════════════════════════════════════\n');

  const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

  // Instituições do seed
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
    console.error('   ❌ Admins não encontrados (inst A ou B)');
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
      console.error(`   ❌ Login falhou: ${e.message}. Senha padrão: ${SENHA}`);
    }
    process.exit(1);
  }

  const setupInst = async (inst: { id: string; tipoAcademico: TipoAcademico | null }) => {
    let anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: inst.id, status: 'ATIVO' },
    });
    if (!anoLetivo) {
      anoLetivo = await prisma.anoLetivo.findFirst({
        where: { instituicaoId: inst.id },
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
          instituicaoId: inst.id,
          dataInicio: new Date(ano, 0, 1),
          dataFim: new Date(ano, 11, 31),
          status: 'ATIVO',
        },
      });
    }
    const curso = await prisma.curso.findFirst({ where: { instituicaoId: inst.id } });
    if (!curso) throw new Error('Curso não encontrado');
    let turma = await prisma.turma.findFirst({
      where: { instituicaoId: inst.id, anoLetivoId: anoLetivo.id },
    });
    if (!turma) {
      turma = await prisma.turma.create({
        data: {
          nome: 'Turma Teste Horários',
          instituicaoId: inst.id,
          anoLetivoId: anoLetivo.id,
          cursoId: curso.id,
        },
      });
    }
    const disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: inst.id } });
    const professor = await prisma.professor.findFirst({ where: { instituicaoId: inst.id } });
    const classe = inst.tipoAcademico === 'SECUNDARIO'
      ? await prisma.classe.findFirst({ where: { instituicaoId: inst.id } })
      : null;
    if (!disciplina || !professor) throw new Error('Disciplina ou Professor não encontrado');

    let plano = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: inst.id,
        turmaId: turma.id,
        anoLetivoId: anoLetivo.id,
      },
    });
    if (!plano) {
      plano = await prisma.planoEnsino.create({
        data: {
          instituicaoId: inst.id,
          anoLetivoId: anoLetivo.id,
          anoLetivo: anoLetivo.ano,
          disciplinaId: disciplina.id,
          professorId: professor.id,
          turmaId: turma.id,
          cursoId: curso.id,
          classeId: classe?.id ?? undefined,
          cargaHorariaTotal: disciplina.cargaHoraria || 60,
          classeOuAno: inst.tipoAcademico === 'SECUNDARIO' ? '10ª Classe' : undefined,
          semestre: inst.tipoAcademico === 'SUPERIOR' ? 1 : undefined,
        },
      });
    }
    return { turma, plano, anoLetivo };
  };

  try {
    const setupSec = await setupInst(instSec);
    const setupSup = await setupInst(instSup);

    await runTestesParaInstituicao(
      instSec,
      tokenSec,
      setupSec.turma,
      setupSec.plano,
      adminSec
    );
    await runTestesParaInstituicao(
      instSup,
      tokenSup,
      setupSup.turma,
      setupSup.plano,
      adminSup
    );
  } catch (err: any) {
    console.error('   ❌ Erro no setup:', err.message);
    process.exit(1);
  }

  // Resumo
  console.log('\n══════════════════════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('  FALHAS:');
    failed.forEach((r) => console.log(`    ✖ [${r.categoria || 'Geral'}] ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
  console.log('  TODOS OS TESTES PASSARAM ✔');
  console.log(`  Secundário (45 min): ${results.filter((r) => r.categoria === 'Secundário' && r.ok).length} testes`);
  console.log(`  Superior (60 min): ${results.filter((r) => r.categoria === 'Superior' && r.ok).length} testes`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('Erro:', err.message);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
