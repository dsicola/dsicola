/**
 * Script para corrigir usuários sem instituicao_id
 */

import prisma from '../src/lib/prisma.js';

async function corrigirUsuariosSemInstituicao() {
  console.log('🔧 CORRIGINDO USUÁRIOS SEM INSTITUICAO_ID\n');
  console.log('='.repeat(80));

  try {
    // Buscar usuários sem instituicao_id
    const usuariosSemInst = await prisma.user.findMany({
      where: { instituicaoId: null },
      include: {
        roles: true,
        instituicao: true,
      },
    });

    console.log(`\n📋 Usuários sem instituicao_id encontrados: ${usuariosSemInst.length}\n`);

    if (usuariosSemInst.length === 0) {
      console.log('✅ Nenhum usuário sem instituicao_id encontrado!');
      return;
    }

    // Listar usuários
    usuariosSemInst.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email} (${user.id})`);
      console.log(`   Nome: ${user.nomeCompleto || 'N/A'}`);
      console.log(`   Roles: ${user.roles.map(r => r.role).join(', ')}`);
      console.log('');
    });

    // Para cada usuário, tentar encontrar instituição através de roles
    for (const user of usuariosSemInst) {
      // Verificar se tem role com instituicaoId
      const roleComInst = user.roles.find(r => r.instituicaoId);
      
      if (roleComInst?.instituicaoId) {
        console.log(`\n🔧 Corrigindo usuário ${user.email}...`);
        console.log(`   Atribuindo instituicao_id: ${roleComInst.instituicaoId}`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { instituicaoId: roleComInst.instituicaoId },
        });
        
        console.log(`   ✅ Usuário corrigido!\n`);
      } else {
        console.log(`\n⚠️  Usuário ${user.email} não tem instituição associada em nenhuma role.`);
        console.log(`   Este usuário precisa ser associado manualmente a uma instituição.\n`);
      }
    }

    console.log('='.repeat(80));
    console.log('✅ Correção concluída!\n');

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
corrigirUsuariosSemInstituicao()
  .then(() => {
    console.log('Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });

