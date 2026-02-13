#!/usr/bin/env npx tsx
/**
 * Script de diagnóstico: Professor não vê atribuições
 *
 * Uso: npx tsx scripts/diagnostico-professor.ts <email-do-professor>
 * Exemplo: npx tsx scripts/diagnostico-professor.ts avelino@gmail.com
 *
 * Verifica:
 * 1. Se o usuário existe
 * 2. Se tem registro na tabela professores
 * 3. Se há planos de ensino com professorId correto (professores.id)
 * 4. Se há planos com professorId errado (users.id)
 */

import prisma from '../src/lib/prisma.js';

const email = process.argv[2] || 'avelino@gmail.com';

async function main() {
  console.log('\n=== DIAGNÓSTICO: Professor não vê atribuições ===\n');
  console.log(`Email: ${email}\n`);

  // 1. Buscar usuário
  const user = await prisma.user.findFirst({
    where: { email },
    include: { roles: { select: { role: true } } },
  });

  if (!user) {
    console.log('❌ 1. Usuário NÃO encontrado com este email.');
    return;
  }
  console.log('✅ 1. Usuário encontrado:', { id: user.id, nome: user.nomeCompleto });

  // 2. Buscar professor
  const professores = await prisma.professor.findMany({
    where: { userId: user.id },
    include: { user: { select: { email: true } } },
  });

  if (professores.length === 0) {
    console.log('❌ 2. Professor NÃO encontrado na tabela professores.');
    console.log('   → Solução: Admin deve criar o professor em Gestão de Professores');
    console.log('   → Ou chamar POST /users/' + user.id + '/professor\n');

    // Verificar se há planos com users.id por engano
    const planosComUser = await prisma.planoEnsino.findMany({
      where: { professorId: user.id },
      include: { disciplina: { select: { nome: true } } },
    });
    if (planosComUser.length > 0) {
      console.log(`⚠️  Encontrados ${planosComUser.length} planos com professorId = users.id (INCORRETO)`);
      console.log('   → Estes planos precisam ser corrigidos para usar professores.id');
    }
    return;
  }

  const professor = professores[0];
  console.log('✅ 2. Professor encontrado:', { id: professor.id, instituicaoId: professor.instituicaoId });

  // 3. Planos com professorId correto (professores.id) E instituicaoId correto
  const planosCorretos = await prisma.planoEnsino.findMany({
    where: {
      professorId: professor.id,
      instituicaoId: professor.instituicaoId,
    },
    include: {
      disciplina: { select: { nome: true } },
      turma: { select: { nome: true } },
    },
  });

  console.log(`\n✅ 3. Planos com professorId CORRETO (professores.id) + instituicaoId: ${planosCorretos.length}`);
  planosCorretos.forEach((p) => {
    console.log(`   - ${p.disciplina?.nome || 'N/A'} | Turma: ${p.turma?.nome || '(sem turma)'} | Ano: ${p.anoLetivo}`);
  });

  // 3b. Planos com professorId correto mas instituicaoId DIFERENTE
  const planosProfessorIdOkInstituicaoErrada = await prisma.planoEnsino.findMany({
    where: {
      professorId: professor.id,
      instituicaoId: { not: professor.instituicaoId },
    },
    include: { disciplina: { select: { nome: true } } },
  });
  if (planosProfessorIdOkInstituicaoErrada.length > 0) {
    console.log(`\n⚠️ 3b. Planos com professorId OK mas instituicaoId DIFERENTE: ${planosProfessorIdOkInstituicaoErrada.length}`);
    planosProfessorIdOkInstituicaoErrada.forEach((p) => {
      console.log(`   - ${p.disciplina?.nome || 'N/A'} | instituicaoId plano: ${p.instituicaoId} | professor.instituicaoId: ${professor.instituicaoId}`);
    });
    console.log(`   → Corrigir: UPDATE plano_ensino SET instituicao_id = '${professor.instituicaoId}' WHERE professor_id = '${professor.id}' AND instituicao_id != '${professor.instituicaoId}';`);
  }

  // 4. Planos com professorId errado (users.id)
  const planosErrados = await prisma.planoEnsino.findMany({
    where: { professorId: user.id },
    include: { disciplina: { select: { nome: true } } },
  });

  if (planosErrados.length > 0) {
    console.log(`\n❌ 4. Planos com professorId ERRADO (users.id): ${planosErrados.length}`);
    planosErrados.forEach((p) => {
      console.log(`   - ${p.id} | ${p.disciplina?.nome || 'N/A'}`);
    });
    console.log('\n   → Executar correção no banco:');
    console.log(`   UPDATE plano_ensino SET "professor_id" = '${professor.id}' WHERE "professor_id" = '${user.id}';`);
  } else {
    console.log('\n✅ 4. Nenhum plano com professorId errado.');
  }

  // Resumo
  console.log('\n--- RESUMO ---');
  if (planosCorretos.length > 0 && planosErrados.length === 0) {
    console.log('O professor deveria ver as atribuições. Se não vê, verificar:');
    console.log('- instituicaoId do JWT no login');
    console.log('- Logs do backend ao acessar /turmas/professor');
  } else if (planosCorretos.length === 0 && planosErrados.length > 0) {
    console.log('CAUSA: Planos foram criados com users.id. Executar o UPDATE acima.');
  } else if (planosCorretos.length === 0 && planosErrados.length === 0) {
    console.log('Não há planos para este professor. Criar em Atribuição de Disciplinas.');
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
