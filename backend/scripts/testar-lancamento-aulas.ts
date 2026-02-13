#!/usr/bin/env npx tsx
/**
 * TESTE: Lançamento de Aulas (getAulasPlanejadas)
 *
 * Verifica se a lógica de buscar aulas planejadas funciona corretamente
 * com os parâmetros: disciplinaId, professorId, anoLetivo, cursoId, turmaId
 *
 * Simula a query que o backend faz em getAulasPlanejadas.
 */
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Lançamento de Aulas (getAulasPlanejadas)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Buscar um plano com aulas
  const plano = await prisma.planoEnsino.findFirst({
    where: {
      aulas: { some: {} },
    },
    include: {
      disciplina: { select: { id: true, nome: true } },
      professor: { select: { id: true, user: { select: { nomeCompleto: true, email: true } } } },
      curso: { select: { id: true, nome: true } },
      turma: { select: { id: true, nome: true } },
      anoLetivoRef: { select: { id: true, ano: true } },
      aulas: {
        orderBy: { ordem: 'asc' },
        include: {
          aulasLancadas: { orderBy: { data: 'desc' } },
          distribuicoes: { orderBy: { data: 'asc' } },
        },
      },
    },
  });

  if (!plano) {
    console.log('❌ Nenhum Plano de Ensino com aulas encontrado.');
    console.log('   Execute primeiro: npx tsx scripts/testar-atribuicao-plano-completo.ts');
    await prisma.$disconnect();
    process.exit(1);
  }

  const { disciplinaId, professorId, anoLetivo, anoLetivoId, cursoId, turmaId, instituicaoId } = plano;

  console.log('1. PLANO ENCONTRADO');
  console.log('   Disciplina:', plano.disciplina?.nome);
  console.log('   Professor:', plano.professor?.user?.nomeCompleto);
  console.log('   Ano Letivo:', anoLetivo);
  console.log('   Curso:', plano.curso?.nome || '(sem curso)');
  console.log('   Turma:', plano.turma?.nome || '(sem turma)');
  console.log('   Aulas planejadas:', plano.aulas.length);
  console.log('');

  // 2. Simular a query exata do getAulasPlanejadas
  const baseWhere: any = {
    disciplinaId,
    professorId,
    anoLetivo: anoLetivo ?? plano.anoLetivoRef?.ano,
    instituicaoId,
  };
  if (cursoId) baseWhere.cursoId = cursoId;
  if (turmaId) baseWhere.turmaId = turmaId;

  const planoSimulado = await prisma.planoEnsino.findFirst({
    where: baseWhere,
    include: {
      aulas: {
        orderBy: { ordem: 'asc' },
        include: {
          aulasLancadas: { orderBy: { data: 'desc' } },
          distribuicoes: { orderBy: { data: 'asc' } },
        },
      },
    },
  });

  if (!planoSimulado) {
    console.log('❌ FALHOU: Query com parâmetros exatos não encontrou o plano');
    console.log('   baseWhere:', JSON.stringify(baseWhere, null, 2));
    await prisma.$disconnect();
    process.exit(1);
  }

  // 3. Formatar como o controller faz
  const aulasFormatadas = planoSimulado.aulas.map((aula) => {
    const lancamentos = aula.aulasLancadas || [];
    const distribuicoes = aula.distribuicoes || [];
    const totalLancado = lancamentos.length;
    const status = totalLancado > 0 ? 'MINISTRADA' : aula.status;

    return {
      id: aula.id,
      ordem: aula.ordem,
      titulo: aula.titulo,
      trimestre: aula.trimestre,
      quantidadeAulas: aula.quantidadeAulas,
      status,
      totalLancado,
      lancamentos: lancamentos.map((l) => ({
        id: l.id,
        data: l.data,
        observacoes: l.observacoes,
      })),
      datasDistribuidas: distribuicoes.map((d) => {
        const date = new Date(d.data);
        date.setHours(0, 0, 0, 0);
        return date.toISOString().split('T')[0];
      }),
    };
  });

  console.log('2. RESULTADO (como o frontend receberia)');
  console.log('   Aulas retornadas:', aulasFormatadas.length);
  aulasFormatadas.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.titulo} | ${a.quantidadeAulas}h | ${a.status} | lançamentos: ${a.lancamentos.length}`);
  });
  console.log('');

  // 4. Verificar parâmetros que o frontend enviaria
  console.log('3. PARÂMETROS PARA O FRONTEND (LancamentoAulasTab)');
  console.log('   disciplinaId:', disciplinaId);
  console.log('   professorId:', professorId, '← OBRIGATÓRIO (professores.id)');
  console.log('   anoLetivo:', anoLetivo);
  console.log('   cursoId:', cursoId || '(opcional)');
  console.log('   turmaId:', turmaId || '(opcional)');
  console.log('   instituicaoId:', instituicaoId);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE OK: getAulasPlanejadas retornaria', aulasFormatadas.length, 'aulas');
  console.log('═══════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
