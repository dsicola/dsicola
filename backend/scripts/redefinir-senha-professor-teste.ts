#!/usr/bin/env npx tsx
/**
 * Redefine a senha de um professor para testes E2E.
 * Senha padrão: Professor@123
 *
 * Uso: npx tsx scripts/redefinir-senha-professor-teste.ts <email> [nova_senha]
 * Exemplo: npx tsx scripts/redefinir-senha-professor-teste.ts avelino1@gmail.com Professor@123
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

const email = process.argv[2]?.toLowerCase();
const novaSenha = process.argv[3] || 'Professor@123';

async function main() {
  if (!email) {
    console.error('Uso: npx tsx scripts/redefinir-senha-professor-teste.ts <email> [nova_senha]');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado:', email);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(novaSenha, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  console.log('✅ Senha redefinida para', user.email);
  console.log('   Nova senha:', novaSenha);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
