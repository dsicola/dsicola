/**
 * Define uma senha de teste para um professor (útil para testes automatizados).
 *
 * Uso: npx tsx scripts/definir-senha-teste-professor.ts <email> <nova-senha>
 * Exemplo: npx tsx scripts/definir-senha-teste-professor.ts prof@email.com TesteProfessor123!
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim();
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Uso: npx tsx scripts/definir-senha-teste-professor.ts <email> <nova-senha>');
    console.log('Exemplo: npx tsx scripts/definir-senha-teste-professor.ts prof@email.com TesteProfessor123!');
    process.exit(1);
  }

  const emailNorm = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    include: { roles: true },
  });

  if (!user) {
    console.log(`❌ Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const temProfessor = user.roles.some((r) => r.role === 'PROFESSOR');
  if (!temProfessor) {
    console.log(`❌ O utilizador ${email} não tem role PROFESSOR.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, mustChangePassword: false },
  });

  console.log(`✅ Senha definida para ${user.nomeCompleto} (${email})`);
  console.log(`   Pode usar: TEST_PROFESSOR_EMAIL=${email} TEST_PROFESSOR_PASSWORD=${newPassword} npm run test:perfil-professor`);
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
