#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO: Professor existente percorrendo todo o fluxo
 *
 * 1. Encontra o primeiro professor no banco
 * 2. Define senha de teste (Professor@123)
 * 3. Executa o fluxo completo: login → JWT → profile → turmas → disciplinas →
 *    plano-ensino → notas → aulas-planejadas → aulas-lancadas → frequências →
 *    avaliações → anos-letivos
 *
 * Valida o hardening professorId/tipoAcademico (JWT, owner+tenant, resolveProfessor).
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-professor-fluxo-completo.ts
 *      ou: TEST_PROFESSOR_EMAIL=prof@email.com npx tsx scripts/test-professor-fluxo-completo.ts
 */
import { spawn } from 'child_process';
import path from 'path';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

const SENHA_TESTE = 'Professor@123';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - Professor existente');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const emailFromEnv = process.env.TEST_PROFESSOR_EMAIL?.trim();

  let professor: {
    id: string;
    userId: string;
    instituicaoId: string;
    user: { email: string; nomeCompleto: string | null };
  } | null;

  if (emailFromEnv) {
    professor = await prisma.professor.findFirst({
      where: { user: { email: emailFromEnv.toLowerCase() } },
      include: { user: { select: { email: true, nomeCompleto: true } } },
    });
    if (!professor) {
      console.error('❌ Professor não encontrado com email:', emailFromEnv);
      console.error('   Verifique TEST_PROFESSOR_EMAIL ou execute: npx tsx scripts/criar-professor.ts', emailFromEnv);
      await prisma.$disconnect();
      process.exit(1);
    }
  } else {
    professor = await prisma.professor.findFirst({
      include: { user: { select: { email: true, nomeCompleto: true } } },
    });
    if (!professor) {
      console.error('❌ Nenhum professor encontrado no banco.');
      console.error('   Crie um professor: npx tsx scripts/criar-professor.ts <email-do-usuario-com-role-professor>');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  const email = professor.user?.email || '';
  console.log('Professor encontrado:', professor.user?.nomeCompleto, `(${email})`);
  console.log('professores.id:', professor.id);
  console.log('Definindo senha de teste...');

  const hash = await bcrypt.hash(SENHA_TESTE, 10);
  await prisma.user.update({
    where: { id: professor.userId },
    data: { password: hash, mustChangePassword: false },
  });
  console.log('✅ Senha definida: Professor@123\n');

  await prisma.$disconnect();

  // Executar test-perfil-professor com as credenciais
  const scriptPath = path.join(__dirname, 'test-perfil-professor.ts');
  const env = {
    ...process.env,
    TEST_PROFESSOR_EMAIL: email,
    TEST_PROFESSOR_PASSWORD: SENHA_TESTE,
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
