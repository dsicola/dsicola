#!/usr/bin/env npx tsx
/**
 * Seed: Criar usuário com perfil COMERCIAL
 *
 * Perfil COMERCIAL: equipe de vendas - onboarding, assinaturas, pagamentos.
 * NÃO acessa: dados acadêmicos, logs sensíveis, configurações globais.
 *
 * Uso:
 *   npx tsx scripts/seed-usuario-comercial.ts
 *   COMERCIAL_EMAIL=joao@empresa.com COMERCIAL_PASSWORD="Senha@123" npx tsx scripts/seed-usuario-comercial.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const COMERCIAL_EMAIL = process.env.COMERCIAL_EMAIL || 'comercial@dsicola.com';
const COMERCIAL_PASSWORD = process.env.COMERCIAL_PASSWORD || 'Comercial@123';
const COMERCIAL_NOME = process.env.COMERCIAL_NOME || 'Equipe Comercial';

async function main() {
  console.log('\n📋 Seed: Usuário COMERCIAL');
  console.log('   Email:', COMERCIAL_EMAIL);
  console.log('   (senha via env COMERCIAL_PASSWORD)\n');

  const hashedPassword = await bcrypt.hash(COMERCIAL_PASSWORD, 12);

  const existing = await prisma.user.findUnique({
    where: { email: COMERCIAL_EMAIL.toLowerCase() },
    select: { id: true, roles: { select: { role: true } } },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashedPassword, nomeCompleto: COMERCIAL_NOME },
    });

    const hasComercial = existing.roles.some((r) => r.role === 'COMERCIAL');
    if (!hasComercial) {
      await prisma.userRole_.create({
        data: { userId: existing.id, role: 'COMERCIAL', instituicaoId: null },
      });
      console.log('✅ Role COMERCIAL adicionada ao usuário existente.');
    }
    console.log('✅ Usuário atualizado.');
  } else {
    const user = await prisma.user.create({
      data: {
        email: COMERCIAL_EMAIL.toLowerCase(),
        password: hashedPassword,
        nomeCompleto: COMERCIAL_NOME,
        instituicaoId: null, // COMERCIAL opera em nível global
        roles: {
          create: { role: 'COMERCIAL', instituicaoId: null },
        },
      },
    });
    console.log('✅ Usuário COMERCIAL criado:', user.id);
  }

  console.log('\n🎉 Concluído. Login em /auth/login com o email configurado.\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
