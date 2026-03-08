import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar SUPER_ADMIN
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Administrador';

  // Verificar se já existe (SUPER_ADMIN tem instituicaoId null - usar compound unique)
  const existingUser = await prisma.user.findUnique({
    where: {
      instituicaoId_email: {
        instituicaoId: null,
        email: superAdminEmail,
      },
    },
    select: {
      id: true,
      email: true,
      nomeCompleto: true,
      password: true,
    },
  });

  if (existingUser) {
    console.log(`⚠️  Usuário ${superAdminEmail} já existe.`);

    // Garantir que a senha do SUPER_ADMIN corresponde à configurada no ambiente (útil em dev)
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        nomeCompleto: superAdminName,
      },
    });
    console.log('✅ Senha/Nome do SUPER_ADMIN atualizados via seed.');

    // Verificar se tem role SUPER_ADMIN
    const hasRole = await prisma.userRole_.findFirst({
      where: {
        userId: existingUser.id,
        role: 'SUPER_ADMIN',
      },
    });

    if (!hasRole) {
      await prisma.userRole_.create({
        data: {
          userId: existingUser.id,
          role: 'SUPER_ADMIN',
        },
      });
      console.log('✅ Role SUPER_ADMIN adicionada ao usuário existente.');
    } else {
      console.log('✅ Usuário já possui role SUPER_ADMIN.');
    }
  } else {
    // Criar novo usuário
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        nomeCompleto: superAdminName,
      },
    });

    // Criar role SUPER_ADMIN
    await prisma.userRole_.create({
      data: {
        userId: user.id,
        role: 'SUPER_ADMIN',
      },
    });

    console.log('✅ SUPER_ADMIN criado com sucesso!');
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Senha: ${superAdminPassword}`);
  }

  // Videoaula de teste Bunny.net (Direct Play → embed) para validar reprodução
  const bunnyTestUrl = 'https://iframe.mediadelivery.net/play/297435/ce7a71b9-c84c-4ecb-9e2c-ec08b61d3260';
  const existingBunny = await prisma.videoAula.findFirst({
    where: { urlVideo: bunnyTestUrl },
  });
  if (!existingBunny) {
    await prisma.videoAula.create({
      data: {
        titulo: 'Introdução (Bunny.net - teste)',
        descricao: 'Vídeo de demonstração hospedado no Bunny.net',
        urlVideo: bunnyTestUrl,
        tipoVideo: 'BUNNY',
        modulo: 'GERAL',
        perfilAlvo: 'TODOS',
        tipoInstituicao: null,
        ordem: 0,
        ativo: true,
      },
    });
    console.log('✅ Videoaula de teste Bunny.net criada.');
  }

  console.log('🎉 Seed concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
