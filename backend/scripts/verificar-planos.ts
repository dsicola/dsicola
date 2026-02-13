#!/usr/bin/env npx tsx
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('\n=== TODOS OS PROFESSORES E PLANOS ===\n');

  const professores = await prisma.professor.findMany({
    include: {
      user: { select: { email: true, nomeCompleto: true } },
      planosEnsino: {
        include: {
          disciplina: { select: { nome: true } },
          turma: { select: { nome: true } },
        },
      },
    },
  });

  for (const prof of professores) {
    console.log(`Professor: ${prof.user?.nomeCompleto} (${prof.user?.email})`);
    console.log(`  - professores.id: ${prof.id}`);
    console.log(`  - instituicaoId: ${prof.instituicaoId}`);
    console.log(`  - Planos: ${prof.planosEnsino.length}`);
    prof.planosEnsino.forEach((p) => {
      const match = p.professorId === prof.id ? '✅' : '❌ (professorId errado!)';
      const instMatch = p.instituicaoId === prof.instituicaoId ? '✅' : `❌ (plano.inst: ${p.instituicaoId})`;
      console.log(`    ${match} ${p.disciplina?.nome || 'N/A'} | Turma: ${p.turma?.nome || '(sem turma)'} | inst ${instMatch}`);
    });
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
