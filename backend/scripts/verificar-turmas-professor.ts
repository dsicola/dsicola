#!/usr/bin/env npx tsx
/**
 * Diagnóstico: verifica se o professor (seed) consegue obter turmas via API.
 * Uso: npx tsx scripts/verificar-turmas-professor.ts
 * Requer: backend a correr (npm run dev), seed multi-tenant já executado.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Diagnóstico: Turmas do Professor (seed) ===\n');

  const email = 'prof.inst.a@teste.dsicola.com';
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { roles: true },
  });
  if (!user) {
    console.log('❌ User não encontrado:', email);
    console.log('   Execute: npm run seed:multi-tenant');
    process.exit(1);
  }
  console.log('✔ User:', user.id, '| email:', user.email, '| instituicaoId:', user.instituicaoId ?? 'NULL');

  const professor = await prisma.professor.findFirst({
    where: { userId: user.id },
  });
  if (!professor) {
    console.log('❌ Professor não encontrado para userId:', user.id);
    process.exit(1);
  }
  console.log('✔ Professor (professores.id):', professor.id, '| instituicaoId:', professor.instituicaoId);

  const instituicaoId = user.instituicaoId ?? professor.instituicaoId;
  if (!instituicaoId) {
    console.log('❌ Nem User nem Professor têm instituicaoId. Corrija o seed ou a base de dados.');
    process.exit(1);
  }

  const planos = await prisma.planoEnsino.findMany({
    where: {
      professorId: professor.id,
      instituicaoId,
    },
    include: {
      disciplina: { select: { nome: true } },
      turma: { select: { id: true, nome: true } },
    },
  });
  console.log('\n✔ Planos de Ensino (PlanoEnsino) para este professor:', planos.length);
  if (planos.length === 0) {
    console.log('   Se 0, a API /turmas/professor devolverá array vazio.');
    console.log('   Verifique se o seed criou PlanoEnsino com professorId =', professor.id, 'e instituicaoId =', instituicaoId);
  } else {
    planos.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.disciplina?.nome ?? '?'} | turma: ${p.turma?.nome ?? 'sem turma'} (id: ${p.turmaId ?? 'null'})`);
    });
  }

  console.log('\n=== Concluído ===\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
