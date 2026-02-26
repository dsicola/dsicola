#!/usr/bin/env npx tsx
/**
 * SEED: Perfis completos para teste de todos os roles
 * Adiciona SECRETARIA, RH, FINANCEIRO, POS, RESPONSAVEL à base do seed-multi-tenant-test
 *
 * Executa seed-multi-tenant-test primeiro (ou usa dados existentes),
 * depois cria os perfis adicionais.
 *
 * Senha: TestMultiTenant123!
 * Uso: npx tsx scripts/seed-perfis-completos.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SEED - PERFIS COMPLETOS (SECRETARIA, RH, FINANCEIRO, POS)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  const instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });

  if (!instA || !instB) {
    console.log('  ⚠ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(SENHA, 10);

  const criarOuAtualizarUser = async (
    email: string,
    nome: string,
    instituicaoId: string,
    roles: string[]
  ) => {
    let user = await prisma.user.findUnique({
      where: { instituicaoId_email: { instituicaoId, email } },
      include: { roles: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nomeCompleto: nome,
          instituicaoId,
          mustChangePassword: false,
        },
        include: { roles: true },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { instituicaoId, password: hashedPassword, mustChangePassword: false },
      });
    }
    for (const role of roles) {
      const exists = await prisma.userRole_.findFirst({
        where: { userId: user!.id, role: role as any },
      });
      if (!exists) {
        await prisma.userRole_.create({
          data: { userId: user!.id, role: role as any, instituicaoId },
        });
      }
    }
    return { user };
  };

  // SECRETARIA A (Secundário) e B (Superior)
  await criarOuAtualizarUser('secretaria.inst.a@teste.dsicola.com', 'Secretaria Inst A', instA.id, ['SECRETARIA']);
  await criarOuAtualizarUser('secretaria.inst.b@teste.dsicola.com', 'Secretaria Inst B', instB.id, ['SECRETARIA']);
  console.log('  ✔ Secretaria A e B criados');

  // RH A e B
  await criarOuAtualizarUser('rh.inst.a@teste.dsicola.com', 'RH Inst A', instA.id, ['RH']);
  await criarOuAtualizarUser('rh.inst.b@teste.dsicola.com', 'RH Inst B', instB.id, ['RH']);
  console.log('  ✔ RH A e B criados');

  // FINANCEIRO A e B
  await criarOuAtualizarUser('financeiro.inst.a@teste.dsicola.com', 'Financeiro Inst A', instA.id, ['FINANCEIRO']);
  await criarOuAtualizarUser('financeiro.inst.b@teste.dsicola.com', 'Financeiro Inst B', instB.id, ['FINANCEIRO']);
  console.log('  ✔ Financeiro A e B criados');

  // POS A e B
  await criarOuAtualizarUser('pos.inst.a@teste.dsicola.com', 'POS Inst A', instA.id, ['POS']);
  await criarOuAtualizarUser('pos.inst.b@teste.dsicola.com', 'POS Inst B', instB.id, ['POS']);
  console.log('  ✔ POS A e B criados');

  // RESPONSAVEL A e B (para E2E e teste full-system)
  await criarOuAtualizarUser('responsavel.inst.a@teste.dsicola.com', 'Responsável Inst A', instA.id, ['RESPONSAVEL']);
  await criarOuAtualizarUser('responsavel.inst.b@teste.dsicola.com', 'Responsável Inst B', instB.id, ['RESPONSAVEL']);
  console.log('  ✔ Responsável A e B criados');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CREDENCIAIS DE TESTE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`
  SECUNDARIO (inst-a):                SUPERIOR (inst-b):
  admin.inst.a@teste.dsicola.com      admin.inst.b@teste.dsicola.com
  secretaria.inst.a@teste.dsicola.com secretaria.inst.b@teste.dsicola.com
  rh.inst.a@teste.dsicola.com         rh.inst.b@teste.dsicola.com
  financeiro.inst.a@teste.dsicola.com financeiro.inst.b@teste.dsicola.com
  pos.inst.a@teste.dsicola.com        pos.inst.b@teste.dsicola.com
  responsavel.inst.a@teste.dsicola.com responsavel.inst.b@teste.dsicola.com
  prof.inst.a@teste.dsicola.com       prof.inst.b@teste.dsicola.com
  aluno.inst.a@teste.dsicola.com      aluno.inst.b@teste.dsicola.com

  Senha para todos: TestMultiTenant123!
  ═══════════════════════════════════════════════════════════════\n`);
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
