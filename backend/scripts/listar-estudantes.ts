/**
 * Lista estudantes (usuários com role ALUNO) existentes no banco.
 * Útil para obter email de um estudante para teste.
 *
 * Uso: npx tsx scripts/listar-estudantes.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== ESTUDANTES CADASTRADOS ===\n');

  const usersWithAlunoRole = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: 'ALUNO' },
      },
    },
    include: {
      roles: true,
      instituicao: { select: { nome: true } },
    },
    orderBy: { nomeCompleto: 'asc' },
  });

  if (usersWithAlunoRole.length === 0) {
    console.log('Nenhum estudante encontrado.');
    console.log('\nPara criar um estudante:');
    console.log('  1. Acesse o painel Admin');
    console.log('  2. Vá em Alunos e crie um novo aluno');
    console.log('  3. O utilizador criado terá role ALUNO automaticamente');
    return;
  }

  console.log(`Encontrados ${usersWithAlunoRole.length} estudante(s):\n`);

  usersWithAlunoRole.forEach((u, i) => {
    const instituicao = u.instituicao?.nome || '(sem instituição)';
    const nif = u.numeroIdentificacaoPublica || '-';
    console.log(`${i + 1}. ${u.nomeCompleto}`);
    console.log(`   Email: ${u.email}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   Instituição: ${instituicao}`);
    console.log(`   Nº Estudante: ${nif}`);
    console.log('');
  });

  console.log('Para testar o perfil estudante, use:');
  console.log('  npm run test:perfil-estudante');
  console.log('  (será pedido email e senha)\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
