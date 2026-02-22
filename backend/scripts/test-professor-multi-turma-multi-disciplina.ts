#!/usr/bin/env npx tsx
/**
 * TESTE: Professor leciona em várias turmas e várias disciplinas
 *
 * Valida (multi-tenant + secundário + superior):
 * 1. Mesmo professor + mesma disciplina + várias turmas (ex: 10ª A 08h, 10ª B 11h)
 * 2. Mesmo professor + várias disciplinas
 * 3. Nenhuma alteração em dados de produção (cria/remove apenas dados de teste)
 *
 * Requer: seed-multi-tenant-test, migration plano_ensino_multi_turma aplicada
 * Uso: npx tsx scripts/test-professor-multi-turma-multi-disciplina.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buscarTurmasProfessorComPlanos } from '../src/services/validacaoAcademica.service.js';

const prisma = new PrismaClient();

const PREFIXO_TESTE = 'TEST-MULTI-TURMA';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Professor em várias turmas e várias disciplinas');
  console.log('  (Multi-tenant, Secundário + Superior)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const idsCriados: {
    planos: string[];
    turmas: string[];
    disciplinas: string[];
    cursos: string[];
    turnos: string[];
    semestres: string[];
  } = { planos: [], turmas: [], disciplinas: [], cursos: [], turnos: [], semestres: [] };

  try {
    // 1. Verificar se migration foi aplicada (partial indexes existem)
    const idxCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM pg_indexes 
      WHERE tablename = 'plano_ensino' AND indexname LIKE '%professor_id%'
    `;
    const temIdxNovo = Number(idxCount[0]?.count ?? 0) >= 1;
    if (!temIdxNovo) {
      console.error('   ❌ Migration plano_ensino_multi_turma não aplicada.');
      console.error('   Execute: cd backend && npx prisma migrate deploy');
      process.exit(1);
    }
    console.log('   ✔ Migration multi-turma aplicada\n');

    // 2. Buscar instituições de teste
    const instSec = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      include: { anosLetivos: { where: { status: 'ATIVO' }, take: 1 } },
    });
    const instSup = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      include: { anosLetivos: { where: { status: 'ATIVO' }, take: 1 } },
    });

    if (!instSec || !instSup) {
      console.error('   ❌ Execute: npx tsx scripts/seed-multi-tenant-test.ts');
      process.exit(1);
    }

    const anoSec = instSec.anosLetivos[0];
    const anoSup = instSup.anosLetivos[0];
    if (!anoSec || !anoSup) {
      console.error('   ❌ Anos letivos ativos não encontrados.');
      process.exit(1);
    }

    // 3. Buscar professor, disciplinas, curso, classe, turno (secundário)
    const profSec = await prisma.professor.findFirst({
      where: { instituicaoId: instSec.id },
      include: { user: { select: { nomeCompleto: true } } },
    });
    const profSup = await prisma.professor.findFirst({
      where: { instituicaoId: instSup.id },
      include: { user: { select: { nomeCompleto: true } } },
    });
    if (!profSec || !profSup) {
      console.error('   ❌ Professores não encontrados nas instituições de teste.');
      process.exit(1);
    }

    // Buscar ou criar dados mínimos (teste autossuficiente)
    let discSec = await prisma.disciplina.findMany({ where: { instituicaoId: instSec.id }, take: 2 });
    let discSup = await prisma.disciplina.findMany({ where: { instituicaoId: instSup.id }, take: 2 });
    let cursoSec = await prisma.curso.findFirst({ where: { instituicaoId: instSec.id } });
    const classeSec = await prisma.classe.findFirst({ where: { instituicaoId: instSec.id } });
    let turnoSec = await prisma.turno.findFirst({ where: { instituicaoId: instSec.id } });
    let cursoSup = await prisma.curso.findFirst({ where: { instituicaoId: instSup.id } });
    let turnoSup = await prisma.turno.findFirst({ where: { instituicaoId: instSup.id } });
    let semSup = await prisma.semestre.findFirst({ where: { anoLetivoId: anoSup.id } });

    // Inst A: garantir 2 disciplinas (seed só cria 1)
    if (discSec.length < 2 && cursoSec) {
      const nova = await prisma.disciplina.create({
        data: {
          instituicaoId: instSec.id,
          nome: `${PREFIXO_TESTE} Física`,
          codigo: 'FIS-TEST',
          cargaHoraria: 60,
          cursoId: cursoSec.id,
        },
      });
      await prisma.cursoDisciplina.upsert({
        where: { cursoId_disciplinaId: { cursoId: cursoSec.id, disciplinaId: nova.id } },
        create: { cursoId: cursoSec.id, disciplinaId: nova.id },
        update: {},
      });
      discSec = [discSec[0], nova];
      idsCriados.disciplinas.push(nova.id);
    }

    // Inst B: criar estrutura se inexistente (seed não cria curso/turno/disciplina/semestre)
    if (!cursoSup) {
      cursoSup = await prisma.curso.create({
        data: {
          instituicaoId: instSup.id,
          nome: `${PREFIXO_TESTE} Engenharia`,
          codigo: 'ENG-TEST',
          valorMensalidade: 0,
        },
      });
      idsCriados.cursos.push(cursoSup.id);
    }
    if (!turnoSup) {
      turnoSup = await prisma.turno.create({
        data: { instituicaoId: instSup.id, nome: `${PREFIXO_TESTE} Diurno` },
      });
      idsCriados.turnos.push(turnoSup.id);
    }
    if (discSup.length < 2) {
      for (const [nome, cod] of [
        [`${PREFIXO_TESTE} Cálculo`, 'CAL-TEST'],
        [`${PREFIXO_TESTE} Álgebra`, 'ALG-TEST'],
      ] as const) {
        if (discSup.length >= 2) break;
        const d = await prisma.disciplina.create({
          data: { instituicaoId: instSup.id, nome, codigo: cod, cargaHoraria: 60, cursoId: cursoSup!.id },
        });
        await prisma.cursoDisciplina.upsert({
          where: { cursoId_disciplinaId: { cursoId: cursoSup!.id, disciplinaId: d.id } },
          create: { cursoId: cursoSup!.id, disciplinaId: d.id },
          update: {},
        });
        discSup = [...discSup, d];
        idsCriados.disciplinas.push(d.id);
      }
    }
    if (!semSup) {
      const ano = anoSup.ano;
      semSup = await prisma.semestre.create({
        data: {
          anoLetivoId: anoSup.id,
          anoLetivo: ano,
          numero: 1,
          dataInicio: new Date(ano, 0, 1),
          dataFim: new Date(ano, 5, 30),
          instituicaoId: instSup.id,
        },
      });
      idsCriados.semestres.push(semSup.id);
    }

    if (!classeSec || !turnoSec || discSec.length < 2 || !cursoSec) {
      console.error('   ❌ Dados insuficientes em inst-a (secundário).');
      process.exit(1);
    }
    if (!cursoSup || !turnoSup || discSup.length < 2 || !semSup) {
      console.error('   ❌ Dados insuficientes em inst-b (superior).');
      process.exit(1);
    }

    console.log('   --- ENSINO SECUNDÁRIO ---');
    // 4a. Criar 2 turmas (10ª A, 10ª B) para mesmo professor + mesma disciplina
    const turmaA = await prisma.turma.create({
      data: {
        instituicaoId: instSec.id,
        anoLetivoId: anoSec.id,
        nome: `${PREFIXO_TESTE} 10ª A`,
        cursoId: cursoSec.id,
        classeId: classeSec.id,
        turnoId: turnoSec.id,
        capacidade: 30,
      },
    });
    const turmaB = await prisma.turma.create({
      data: {
        instituicaoId: instSec.id,
        anoLetivoId: anoSec.id,
        nome: `${PREFIXO_TESTE} 10ª B`,
        cursoId: cursoSec.id,
        classeId: classeSec.id,
        turnoId: turnoSec.id,
        capacidade: 30,
      },
    });
    idsCriados.turmas.push(turmaA.id, turmaB.id);

    // Plano 1: prof + disc1 + turmaA
    const plano1 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSec.id,
        professorId: profSec.id,
        disciplinaId: discSec[0].id,
        anoLetivoId: anoSec.id,
        anoLetivo: anoSec.ano,
        turmaId: turmaA.id,
        classeId: classeSec.id,
        classeOuAno: classeSec.nome,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    // Plano 2: prof + disc1 + turmaB (MESMA disciplina, OUTRA turma)
    const plano2 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSec.id,
        professorId: profSec.id,
        disciplinaId: discSec[0].id,
        anoLetivoId: anoSec.id,
        anoLetivo: anoSec.ano,
        turmaId: turmaB.id,
        classeId: classeSec.id,
        classeOuAno: classeSec.nome,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    idsCriados.planos.push(plano1.id, plano2.id);

    // Plano 3: prof + disc2 (OUTRA disciplina)
    const turmaC = await prisma.turma.create({
      data: {
        instituicaoId: instSec.id,
        anoLetivoId: anoSec.id,
        nome: `${PREFIXO_TESTE} 10ª C`,
        cursoId: cursoSec.id,
        classeId: classeSec.id,
        turnoId: turnoSec.id,
        capacidade: 30,
      },
    });
    idsCriados.turmas.push(turmaC.id);
    const plano3 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSec.id,
        professorId: profSec.id,
        disciplinaId: discSec[1].id,
        anoLetivoId: anoSec.id,
        anoLetivo: anoSec.ano,
        turmaId: turmaC.id,
        classeId: classeSec.id,
        classeOuAno: classeSec.nome,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    idsCriados.planos.push(plano3.id);

    // 5. Validar: buscarTurmasProfessorComPlanos deve retornar 3 entradas
    const turmasProfSec = await buscarTurmasProfessorComPlanos(instSec.id, profSec.id, anoSec.id);
    const comTurma = turmasProfSec.filter((t) => t.turma?.id);
    const mesmaDisc = turmasProfSec.filter((t) => t.disciplinaId === discSec[0].id);

    if (comTurma.length < 3) {
      throw new Error(`Secundário: esperava ≥3 turmas, obteve ${comTurma.length}`);
    }
    if (mesmaDisc.length < 2) {
      throw new Error(`Secundário: esperava ≥2 turmas na mesma disciplina, obteve ${mesmaDisc.length}`);
    }

    console.log(`   ✔ Secundário: professor vê ${turmasProfSec.length} planos (${mesmaDisc.length} mesma disciplina em turmas diferentes)`);

    // --- ENSINO SUPERIOR ---
    console.log('\n   --- ENSINO SUPERIOR ---');
    const turmaSupA = await prisma.turma.create({
      data: {
        instituicaoId: instSup.id,
        anoLetivoId: anoSup.id,
        nome: `${PREFIXO_TESTE} 1º Ano A`,
        cursoId: cursoSup.id,
        turnoId: turnoSup.id,
        capacidade: 30,
      },
    });
    const turmaSupB = await prisma.turma.create({
      data: {
        instituicaoId: instSup.id,
        anoLetivoId: anoSup.id,
        nome: `${PREFIXO_TESTE} 1º Ano B`,
        cursoId: cursoSup.id,
        turnoId: turnoSup.id,
        capacidade: 30,
      },
    });
    const turmaSupC = await prisma.turma.create({
      data: {
        instituicaoId: instSup.id,
        anoLetivoId: anoSup.id,
        nome: `${PREFIXO_TESTE} 1º Ano C`,
        cursoId: cursoSup.id,
        turnoId: turnoSup.id,
        capacidade: 30,
      },
    });
    idsCriados.turmas.push(turmaSupA.id, turmaSupB.id, turmaSupC.id);

    const planoSup1 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSup.id,
        professorId: profSup.id,
        disciplinaId: discSup[0].id,
        anoLetivoId: anoSup.id,
        anoLetivo: anoSup.ano,
        turmaId: turmaSupA.id,
        cursoId: cursoSup.id,
        semestre: semSup.numero,
        semestreId: semSup.id,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    const planoSup2 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSup.id,
        professorId: profSup.id,
        disciplinaId: discSup[0].id,
        anoLetivoId: anoSup.id,
        anoLetivo: anoSup.ano,
        turmaId: turmaSupB.id,
        cursoId: cursoSup.id,
        semestre: semSup.numero,
        semestreId: semSup.id,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    idsCriados.planos.push(planoSup1.id, planoSup2.id);

    const planoSup3 = await prisma.planoEnsino.create({
      data: {
        instituicaoId: instSup.id,
        professorId: profSup.id,
        disciplinaId: discSup[1].id,
        anoLetivoId: anoSup.id,
        anoLetivo: anoSup.ano,
        turmaId: turmaSupC.id,
        cursoId: cursoSup.id,
        semestre: semSup.numero,
        semestreId: semSup.id,
        status: 'APROVADO' as any,
        estado: 'APROVADO' as any,
      },
    });
    idsCriados.planos.push(planoSup3.id);

    const turmasProfSup = await buscarTurmasProfessorComPlanos(instSup.id, profSup.id, anoSup.id);
    const comTurmaSup = turmasProfSup.filter((t) => t.turma?.id);
    const mesmaDiscSup = turmasProfSup.filter((t) => t.disciplinaId === discSup[0].id);

    if (comTurmaSup.length < 3) {
      throw new Error(`Superior: esperava ≥3 turmas, obteve ${comTurmaSup.length}`);
    }
    if (mesmaDiscSup.length < 2) {
      throw new Error(`Superior: esperava ≥2 turmas na mesma disciplina, obteve ${mesmaDiscSup.length}`);
    }

    console.log(`   ✔ Superior: professor vê ${turmasProfSup.length} planos (${mesmaDiscSup.length} mesma disciplina em turmas diferentes)`);

    // 6. Multi-tenant: professor de instSec não tem planos em instSup (consulta cruza instituições)
    const turmasProfSecEmSup = await buscarTurmasProfessorComPlanos(instSup.id, profSec.id, anoSup.id);
    if (turmasProfSecEmSup.length > 0) {
      throw new Error(`Multi-tenant: prof instSec consultando instSup deve retornar 0, obteve ${turmasProfSecEmSup.length}`);
    }
    console.log('\n   ✔ Multi-tenant: isolamento entre instituições verificado');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ✅ TODOS OS TESTES PASSARAM');
    console.log('  - Professor pode lecionar mesma disciplina em várias turmas');
    console.log('  - Professor pode lecionar várias disciplinas');
    console.log('  - Funciona em Secundário e Superior');
    console.log('  - Multi-tenant respeitado');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } finally {
    // Limpar dados de teste (não altera produção) - ordem: FKs primeiro
    if (idsCriados.planos.length > 0) {
      await prisma.planoEnsino.deleteMany({ where: { id: { in: idsCriados.planos } } });
      console.log(`   🧹 ${idsCriados.planos.length} planos de teste removidos`);
    }
    if (idsCriados.turmas.length > 0) {
      await prisma.turma.deleteMany({ where: { id: { in: idsCriados.turmas } } });
      console.log(`   🧹 ${idsCriados.turmas.length} turmas de teste removidas`);
    }
    if (idsCriados.disciplinas.length > 0) {
      await prisma.cursoDisciplina.deleteMany({ where: { disciplinaId: { in: idsCriados.disciplinas } } });
      await prisma.disciplina.deleteMany({ where: { id: { in: idsCriados.disciplinas } } });
      console.log(`   🧹 ${idsCriados.disciplinas.length} disciplinas de teste removidas`);
    }
    if (idsCriados.semestres.length > 0) {
      await prisma.semestre.deleteMany({ where: { id: { in: idsCriados.semestres } } });
      console.log(`   🧹 ${idsCriados.semestres.length} semestres de teste removidos`);
    }
    if (idsCriados.cursos.length > 0) {
      await prisma.curso.deleteMany({ where: { id: { in: idsCriados.cursos } } });
      console.log(`   🧹 ${idsCriados.cursos.length} cursos de teste removidos`);
    }
    if (idsCriados.turnos.length > 0) {
      await prisma.turno.deleteMany({ where: { id: { in: idsCriados.turnos } } });
      console.log(`   🧹 ${idsCriados.turnos.length} turnos de teste removidos`);
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('\n   ❌ ERRO:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
