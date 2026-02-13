#!/usr/bin/env npx ts-node
/**
 * Script de verificação pós-migração backfill professores
 * 
 * Executa após: prisma migrate deploy (migration 20260211000000_backfill_professores_plano_ensino)
 * 
 * Verifica:
 * - Quantos professores existem
 * - Quantos users com role PROFESSOR têm registro em professores
 * - Quantos planos_ensino têm professor_id válido (professores.id)
 * - Lista planos com professor_id inválido (se houver)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== VERIFICAÇÃO PÓS-BACKFILL PROFESSORES ===\n');

  // 1. Total de professores
  const totalProfessores = await prisma.professor.count();
  console.log(`1. Total de professores na tabela: ${totalProfessores}`);

  // 2. Users com role PROFESSOR
  const usersComRoleProfessor = await prisma.userRole_.findMany({
    where: { role: 'PROFESSOR' },
    select: { userId: true },
    distinct: ['userId'],
  });
  const totalUsersProfessor = usersComRoleProfessor.length;
  console.log(`2. Users com role PROFESSOR: ${totalUsersProfessor}`);

  // 3. Users com role PROFESSOR que TÊM registro em professores
  const userIdsProfessor = usersComRoleProfessor.map((u) => u.userId);
  const professorsExistentes = await prisma.professor.findMany({
    where: { userId: { in: userIdsProfessor } },
    select: { userId: true },
  });
  const usersComRegistro = professorsExistentes.length;
  console.log(`3. Users PROFESSOR com registro em professores: ${usersComRegistro}`);

  if (totalUsersProfessor > 0 && usersComRegistro < totalUsersProfessor) {
    const semRegistro = userIdsProfessor.filter(
      (id) => !professorsExistentes.some((p) => p.userId === id)
    );
    console.warn(`   ⚠️ Users sem registro: ${semRegistro.length} - IDs: ${semRegistro.slice(0, 3).join(', ')}...`);
  }

  // 4. Planos de ensino
  const totalPlanos = await prisma.planoEnsino.count();
  const planosComProfessorValido = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM plano_ensino pe
     INNER JOIN professores p ON pe.professor_id = p.id`
  );
  const planosComProfessorInválido = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM plano_ensino pe
     WHERE pe.professor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM professores p WHERE p.id = pe.professor_id)`
  );
  const invalidos = Number(planosComProfessorInválido[0]?.count ?? 0);

  console.log(`4. Total de planos de ensino: ${totalPlanos}`);
  console.log(`   - Planos com professor_id válido (professores.id): ${Number(planosComProfessorValido[0]?.count ?? 0)}`);
  console.log(`   - Planos com professor_id inválido (users.id ou inexistente): ${invalidos}`);

  if (invalidos > 0) {
    const planosProblema = await prisma.$queryRawUnsafe<
      { id: string; professor_id: string }[]
    >(
      `SELECT id, professor_id FROM plano_ensino pe
       WHERE pe.professor_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM professores p WHERE p.id = pe.professor_id)
       LIMIT 5`
    );
    console.warn(`   ⚠️ Exemplo de planos com problema:`, planosProblema);
  }

  // 5. Logs claros para auditoria (conforme especificação)
  console.log('\n--- RESUMO PÓS-MIGRAÇÃO ---');
  console.log(`Professores na tabela: ${totalProfessores}`);
  console.log(`Users com role PROFESSOR: ${totalUsersProfessor}`);
  console.log(`Users PROFESSOR com registro em professores: ${usersComRegistro}`);
  console.log(`Planos com professor_id válido (professores.id): ${Number(planosComProfessorValido[0]?.count ?? 0)}`);
  console.log(`Planos com professor_id inválido (corrigir): ${invalidos}`);

  if (invalidos > 0) {
    console.warn('\n⚠️ Execute a migration 20260211000000_backfill_professores_plano_ensino para corrigir.');
  }
  if (totalUsersProfessor > 0 && usersComRegistro < totalUsersProfessor) {
    console.warn('\n⚠️ Alguns users com role PROFESSOR não têm registro em professores. Execute a migration.');
  }

  console.log('\n=== FIM DA VERIFICAÇÃO ===\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
