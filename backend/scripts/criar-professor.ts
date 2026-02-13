#!/usr/bin/env npx tsx
/**
 * Script para criar registro de Professor na tabela professores
 * Usado quando o usuário tem role PROFESSOR mas não tem registro na tabela professores
 *
 * Uso: npx tsx scripts/criar-professor.ts <email-do-usuario> [instituicao-id]
 * Exemplo: npx tsx scripts/criar-professor.ts avelino@gmail.com
 *
 * Se instituicaoId não for informado, usa user.instituicaoId ou a primeira instituição.
 */

import prisma from '../src/lib/prisma.js';

const email = process.argv[2];
const instituicaoIdArg = process.argv[3];

async function main() {
  if (!email) {
    console.error('Uso: npx tsx scripts/criar-professor.ts <email> [instituicao-id]');
    process.exit(1);
  }

  console.log('\n=== Criar Professor (registro na tabela professores) ===\n');

  const user = await prisma.user.findFirst({
    where: { email },
    include: { roles: { select: { role: true } } },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado com email:', email);
    process.exit(1);
  }

  const hasProfessorRole = user.roles.some((r) => r.role === 'PROFESSOR');
  if (!hasProfessorRole) {
    console.error('❌ Usuário não tem role PROFESSOR. Adicione a role antes de criar o professor.');
    process.exit(1);
  }

  let instituicaoId = instituicaoIdArg || user.instituicaoId;

  if (!instituicaoId) {
    const ctx = await prisma.userContext.findFirst({
      where: { userId: user.id },
      select: { instituicaoId: true },
    });
    instituicaoId = ctx?.instituicaoId || undefined;
  }

  if (!instituicaoId) {
    const primeiraInst = await prisma.instituicao.findFirst({
      select: { id: true, nome: true },
    });
    if (primeiraInst) {
      instituicaoId = primeiraInst.id;
      console.log(`ℹ️  Usando instituição: ${primeiraInst.nome} (${instituicaoId})`);
    }
  }

  if (!instituicaoId) {
    console.error('❌ Não foi possível determinar instituicaoId. Informe manualmente:');
    console.error('   npx tsx scripts/criar-professor.ts', email, '<instituicao-id>');
    process.exit(1);
  }

  const existente = await prisma.professor.findFirst({
    where: { userId: user.id, instituicaoId },
  });

  if (existente) {
    console.log('✅ Professor já existe:', existente.id);
    console.log('   O usuário já pode ver as atribuições.');
    return;
  }

  const professor = await prisma.professor.create({
    data: {
      userId: user.id,
      instituicaoId,
    },
    include: {
      user: { select: { nomeCompleto: true, email: true } },
    },
  });

  console.log('✅ Professor criado com sucesso!');
  console.log('   ID (professores.id):', professor.id);
  console.log('   Nome:', professor.user?.nomeCompleto);
  console.log('   Email:', professor.user?.email);
  console.log('\nPróximos passos:');
  console.log('1. Admin: criar atribuição em Professores → Atribuição de Disciplinas');
  console.log('2. Professor: fazer logout e login novamente');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
