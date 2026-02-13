#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO - Perfil ESTUDANTE (ALUNO)
 *
 * 1. Encontra primeiro aluno no banco
 * 2. Define senha de teste (Estudante@123)
 * 3. Executa fluxo completo: login → profile → matrículas → notas → frequências →
 *    mensalidades → eventos → comunicados → documentos → biblioteca
 *
 * Requer: Backend rodando em http://localhost:3001
 */
import { spawn } from 'child_process';
import path from 'path';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

const SENHA_TESTE = process.env.TEST_ALUNO_PASSWORD || 'Estudante@123';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - Estudante (ALUNO)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const emailFromEnv = process.env.TEST_ALUNO_EMAIL?.trim();

  let aluno: { id: string; email: string; nomeCompleto: string | null; instituicaoId: string | null } | null = null;

  if (emailFromEnv) {
    const user = await prisma.user.findFirst({
      where: { email: emailFromEnv.toLowerCase() },
      include: { roles: { select: { role: true } } },
    });
    if (user && user.roles.some((r) => r.role === 'ALUNO')) {
      aluno = { id: user.id, email: user.email, nomeCompleto: user.nomeCompleto, instituicaoId: user.instituicaoId };
    }
    if (!aluno) {
      console.error('❌ Usuário não encontrado ou não possui role ALUNO:', emailFromEnv);
      await prisma.$disconnect();
      process.exit(1);
    }
  } else {
    const userAluno = await prisma.user.findFirst({
      where: {
        roles: { some: { role: 'ALUNO' } },
        instituicaoId: { not: null },
      },
      include: { roles: { select: { role: true } } },
    });
    if (userAluno) {
      aluno = {
        id: userAluno.id,
        email: userAluno.email,
        nomeCompleto: userAluno.nomeCompleto,
        instituicaoId: userAluno.instituicaoId,
      };
    }
  }

  if (!aluno) {
    console.error('❌ Nenhum estudante encontrado no banco.');
    console.error('   Crie um aluno ou execute: npm run db:seed');
    await prisma.$disconnect();
    process.exit(1);
  }

  const email = aluno.email;
  console.log('Estudante encontrado:', aluno.nomeCompleto || email);
  console.log('Definindo senha de teste...');

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: aluno.id },
    data: { password: hash, mustChangePassword: false },
  });
  console.log(`✅ Senha definida: ${SENHA_TESTE}\n`);

  await prisma.$disconnect();

  const scriptPath = path.join(__dirname, 'test-perfil-estudante.ts');
  const env = {
    ...process.env,
    TEST_ALUNO_EMAIL: email,
    TEST_ALUNO_PASSWORD: SENHA_TESTE,
  };

  const child = spawn('npx', ['tsx', scriptPath], {
    stdio: 'inherit',
    env,
    cwd: path.join(__dirname, '..'),
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('Erro ao executar teste:', err);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
