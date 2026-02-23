#!/usr/bin/env npx tsx
/**
 * TESTE: Gerar Sugestões - Ensino Superior
 *
 * Valida o fluxo "Gerar Sugestões" para instituições do tipo SUPERIOR:
 * - Blocos de 60 min (hora-relógio)
 * - Turnos manhã (8-12h), tarde (14-18h), noite (18-22h)
 * - Evita conflitos de turma e professor
 * - Retorna disciplina, professor, dia, horário
 *
 * Não requer backend HTTP rodando - usa o service diretamente.
 * Uso: npx tsx backend/scripts/test-sugestoes-superior-only.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as horarioService from '../src/services/horario.service.js';

const prisma = new PrismaClient();

const results: { name: string; ok: boolean; details?: string }[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

function minutosEntreHoras(horaInicio: string, horaFim: string): number {
  const [h1, m1] = (horaInicio || '00:00').split(':').map(Number);
  const [h2, m2] = (horaFim || '00:00').split(':').map(Number);
  return (h2 - h1) * 60 + (m2 - m1);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Gerar Sugestões - Ensino Superior');
  console.log('══════════════════════════════════════════════════════════════\n');

  // Buscar instituição SUPERIOR
  const instSup = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
    select: { id: true, nome: true, tipoAcademico: true },
  });

  if (!instSup) {
    const fallback = await prisma.instituicao.findFirst({
      where: { tipoAcademico: 'SUPERIOR' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!fallback) {
      console.error('   ❌ Nenhuma instituição SUPERIOR encontrada. Execute: npx tsx backend/scripts/seed-multi-tenant-test.ts');
      process.exit(1);
    }
    Object.assign(instSup!, fallback);
  }

  assert('Instituição SUPERIOR encontrada', instSup!.tipoAcademico === 'SUPERIOR', instSup!.nome);

  // Buscar turma com planos
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instSup!.id, status: 'ATIVO' },
  });
  if (!anoLetivo) {
    anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instSup!.id },
    });
  }
  if (!anoLetivo) {
    const ano = new Date().getFullYear();
    anoLetivo = await prisma.anoLetivo.create({
      data: {
        ano,
        instituicaoId: instSup!.id,
        dataInicio: new Date(ano, 0, 1),
        dataFim: new Date(ano, 11, 31),
        status: 'ATIVO',
      },
    });
  }

  const curso = await prisma.curso.findFirst({ where: { instituicaoId: instSup!.id } });
  if (!curso) {
    assert('Curso existente', false, 'Crie um curso');
    process.exit(1);
  }

  let turma = await prisma.turma.findFirst({
    where: { instituicaoId: instSup!.id, anoLetivoId: anoLetivo.id },
  });
  if (!turma) {
    turma = await prisma.turma.create({
      data: {
        nome: 'Turma Teste Sugestões Superior',
        instituicaoId: instSup!.id,
        anoLetivoId: anoLetivo.id,
        cursoId: curso.id,
      },
    });
  }

  const disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instSup!.id } });
  const professor = await prisma.professor.findFirst({ where: { instituicaoId: instSup!.id } });
  if (!disciplina || !professor) {
    assert('Disciplina e Professor', false, 'Execute seed-multi-tenant-test');
    process.exit(1);
  }

  let plano = await prisma.planoEnsino.findFirst({
    where: {
      instituicaoId: instSup!.id,
      turmaId: turma.id,
      anoLetivoId: anoLetivo.id,
    },
  });
  if (!plano) {
    plano = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSup!.id,
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        disciplinaId: disciplina.id,
        professorId: professor.id,
        turmaId: turma.id,
        cursoId: curso.id,
        cargaHorariaTotal: disciplina.cargaHoraria || 60,
        semestre: 1,
      },
    });
  }

  await prisma.horario.deleteMany({ where: { turmaId: turma.id } });

  console.log(`  Turma: ${turma.nome} (${turma.id})`);
  console.log(`  Plano: ${plano.id} (disciplina + professor)\n`);

  // ─── 1. Sugestões Manhã (8h-12h, blocos 60 min) ─────────────────────────
  console.log('1. GET sugestões turno MANHÃ\n');
  const sugestoesManha = await horarioService.obterSugestoesHorarios(turma.id, instSup!.id, { turno: 'manha' });
  assert('Retorna array', Array.isArray(sugestoesManha));
  assert('Ao menos 1 sugestão', sugestoesManha.length >= 1, `total=${sugestoesManha.length}`);

  if (sugestoesManha.length > 0) {
    const s = sugestoesManha[0];
    assert('Sugestão tem planoEnsinoId', !!s.planoEnsinoId);
    assert('Sugestão tem turmaId', s.turmaId === turma.id);
    assert('Sugestão tem diaSemana 1-5', s.diaSemana >= 1 && s.diaSemana <= 5, `dia=${s.diaSemana}`);
    const duracao = minutosEntreHoras(s.horaInicio, s.horaFim);
    assert('Bloco 60 min (Superior)', duracao === 60, `minutos=${duracao}`);
    const hInicio = parseInt((s.horaInicio || '00:00').split(':')[0], 10);
    assert('Manhã: início 8h-12h', hInicio >= 8 && hInicio < 12, `início=${s.horaInicio}`);
    assert('Tem disciplinaNome ou professorNome', !!(s.disciplinaNome || s.professorNome));
  }

  // ─── 2. Sugestões Tarde (14h-18h) ───────────────────────────────────────
  console.log('\n2. GET sugestões turno TARDE\n');
  const sugestoesTarde = await horarioService.obterSugestoesHorarios(turma.id, instSup!.id, { turno: 'tarde' });
  assert('Tarde retorna 200/array', Array.isArray(sugestoesTarde));
  if (sugestoesTarde.length > 0) {
    const h = parseInt((sugestoesTarde[0].horaInicio || '14:00').split(':')[0], 10);
    assert('Tarde: início ≥ 14h', h >= 14, `início=${sugestoesTarde[0].horaInicio}`);
  }

  // ─── 3. Sugestões Noite (18h-22h) ───────────────────────────────────────
  console.log('\n3. GET sugestões turno NOITE\n');
  const sugestoesNoite = await horarioService.obterSugestoesHorarios(turma.id, instSup!.id, { turno: 'noite' });
  assert('Noite retorna array', Array.isArray(sugestoesNoite));
  if (sugestoesNoite.length > 0) {
    const h = parseInt((sugestoesNoite[0].horaInicio || '18:00').split(':')[0], 10);
    assert('Noite: início ≥ 18h', h >= 18, `início=${sugestoesNoite[0].horaInicio}`);
  }

  // ─── 4. Formato da sugestão (como na UI) ─────────────────────────────────
  console.log('\n4. Formato esperado (Disciplina | Professor | Dia | Horário)\n');
  if (sugestoesManha.length > 0) {
    const s = sugestoesManha[0];
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    assert('Exemplo visível', true, `${s.disciplinaNome || '-'} | ${s.professorNome || '-'} | ${dias[s.diaSemana]} ${s.horaInicio}-${s.horaFim}`);
  }

  // ─── RESUMO ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('  FALHAS:');
    failed.forEach((r) => console.log(`    ✖ ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
  console.log('  GERAR SUGESTÕES - ENSINO SUPERIOR: OK ✔');
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
