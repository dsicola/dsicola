import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function countUsers() {
  try {
    // Count total users
    const totalUsers = await prisma.user.count();
    
    // Count users by role
    const usersByRole = await prisma.userRole_.groupBy({
      by: ['role'],
      _count: {
        role: true,
      },
    });

    // Count users by institution
    const usersByInstitution = await prisma.user.groupBy({
      by: ['instituicaoId'],
      _count: {
        id: true,
      },
    });

    console.log('\n📊 ESTATÍSTICAS DE USUÁRIOS\n');
    console.log(`Total de usuários: ${totalUsers}\n`);

    console.log('Usuários por papel:');
    usersByRole.forEach((item) => {
      console.log(`  - ${item.role}: ${item._count.role}`);
    });

    console.log('\nUsuários por instituição:');
    const instituicoes = await prisma.instituicao.findMany({
      select: { id: true, nome: true },
    });
    
    usersByInstitution.forEach((item) => {
      const instituicao = instituicoes.find((i) => i.id === item.instituicaoId);
      const nome = instituicao ? instituicao.nome : 'Sem instituição';
      console.log(`  - ${nome}: ${item._count.id}`);
    });

    // Count users without institution
    const usersWithoutInstitution = await prisma.user.count({
      where: { instituicaoId: null },
    });
    if (usersWithoutInstitution > 0) {
      console.log(`  - Sem instituição: ${usersWithoutInstitution}`);
    }

    console.log('\n✅ Contagem concluída!\n');
  } catch (error) {
    console.error('❌ Erro ao contar usuários:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

countUsers();

