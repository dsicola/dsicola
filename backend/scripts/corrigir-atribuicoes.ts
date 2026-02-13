#!/usr/bin/env npx tsx
/**
 * Script para corrigir atribuições:
 * 1. Planos com professorId = users.id → corrigir para professors.id
 * 2. Planos com instituicaoId diferente do professor → corrigir
 * 3. Opcional: Atribuir plano a professor sem atribuições (--atribuir EMAIL)
 */
import prisma from '../src/lib/prisma.js';

async function main() {
  const args = process.argv.slice(2);
  const atribuirEmail = args.find((a) => a.startsWith('--atribuir='))?.split('=')[1];

  console.log('\n=== CORREÇÃO DE ATRIBUICOES ===\n');

  // 1. Corrigir planos com professorId = users.id
  const professores = await prisma.professor.findMany({ select: { id: true, userId: true, instituicaoId: true } });
  const professorIds = new Set(professores.map((p) => p.id));
  const userToProfessor = new Map(professores.map((p) => [p.userId, p]));

  const planos = await prisma.planoEnsino.findMany({
    include: { disciplina: { select: { nome: true } } },
  });

  let corrigidos = 0;
  for (const plano of planos) {
    const prof = userToProfessor.get(plano.professorId);
    if (!professorIds.has(plano.professorId) && prof) {
      console.log(`Corrigindo plano ${plano.disciplina?.nome} (professorId ${plano.professorId} → ${prof.id})`);
      await prisma.planoEnsino.update({
        where: { id: plano.id },
        data: { professorId: prof.id },
      });
      corrigidos++;
    }
    if (professorIds.has(plano.professorId)) {
      const profCorreto = professores.find((p) => p.id === plano.professorId);
      if (profCorreto && plano.instituicaoId !== profCorreto.instituicaoId) {
        console.log(`Corrigindo plano ${plano.disciplina?.nome} (instituicaoId ${plano.instituicaoId} → ${profCorreto.instituicaoId})`);
        await prisma.planoEnsino.update({
          where: { id: plano.id },
          data: { instituicaoId: profCorreto.instituicaoId },
        });
        corrigidos++;
      }
    }
  }

  if (corrigidos > 0) {
    console.log(`\n✅ ${corrigidos} plano(s) corrigido(s).`);
  } else {
    console.log('Nenhum plano precisou de correção.');
  }

  // 2. Atribuir plano a professor sem atribuições: --atribuir=email@exemplo.com
  if (atribuirEmail) {
    const user = await prisma.user.findFirst({ where: { email: atribuirEmail } });
    if (!user) {
      console.log(`\n❌ Usuário não encontrado: ${atribuirEmail}`);
      await prisma.$disconnect();
      return;
    }
    const prof = await prisma.professor.findFirst({
      where: { userId: user.id },
      include: { user: { select: { nomeCompleto: true } } },
    });
    if (!prof) {
      console.log(`\n❌ Professor não encontrado para ${atribuirEmail}. Cadastre em Gestão de Professores.`);
      await prisma.$disconnect();
      return;
    }
    const planosExist = await prisma.planoEnsino.findMany({
      where: { professorId: prof.id },
      include: { disciplina: { select: { nome: true } } },
    });
    if (planosExist.length > 0) {
      console.log(`\n✅ Professor ${prof.user?.nomeCompleto} já tem ${planosExist.length} plano(s).`);
      await prisma.$disconnect();
      return;
    }
    // Encontrar disciplina e ano sem plano para criar
    const anoAtivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: prof.instituicaoId, status: 'ATIVO' },
    });
    if (!anoAtivo) {
      console.log(`\n❌ Nenhum ano letivo ativo. Ative um ano em Anos Letivos.`);
      await prisma.$disconnect();
      return;
    }
    const planosInst = await prisma.planoEnsino.findMany({
      where: { instituicaoId: prof.instituicaoId, anoLetivoId: anoAtivo.id },
      select: { disciplinaId: true },
    });
    const disciplinasUsadas = new Set(planosInst.map((p) => p.disciplinaId));
    const disciplina = await prisma.disciplina.findFirst({
      where: {
        instituicaoId: prof.instituicaoId,
        id: { notIn: [...disciplinasUsadas] },
      },
    });
    if (!disciplina) {
      console.log(`\n❌ Todas as disciplinas já têm planos. Crie nova disciplina ou use Atribuição de Disciplinas.`);
      await prisma.$disconnect();
      return;
    }
    await prisma.planoEnsino.create({
      data: {
        professorId: prof.id,
        disciplinaId: disciplina.id,
        anoLetivoId: anoAtivo.id,
        anoLetivo: anoAtivo.ano,
        instituicaoId: prof.instituicaoId,
        cargaHorariaTotal: disciplina.cargaHoraria || 0,
        cargaHorariaPlanejada: 0,
      },
    });
    console.log(`\n✅ Criado plano para ${prof.user?.nomeCompleto}: ${disciplina.nome}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
