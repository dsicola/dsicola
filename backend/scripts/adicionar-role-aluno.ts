/**
 * Script para Adicionar Role ALUNO a Usuários Existentes
 * 
 * Útil quando alunos foram criados sem a role ALUNO
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function adicionarRoleAluno() {
  try {
    console.log('\n=== ADICIONAR ROLE ALUNO A USUÁRIOS ===\n');
    
    // Buscar todos os usuários que NÃO têm role ALUNO
    const usersSemRoleAluno = await prisma.user.findMany({
      include: {
        roles: true
      }
    });
    
    const usuariosParaAtualizar = usersSemRoleAluno.filter(user => {
      const roles = user.roles.map(r => r.role);
      return !roles.includes('ALUNO');
    });
    
    if (usuariosParaAtualizar.length === 0) {
      console.log('✅ Todos os usuários já têm role ALUNO ou não são alunos');
      return;
    }
    
    console.log(`Encontrados ${usuariosParaAtualizar.length} usuários sem role ALUNO:\n`);
    
    usuariosParaAtualizar.forEach((user, index) => {
      const roles = user.roles.map(r => r.role).join(', ') || 'NENHUMA';
      console.log(`${index + 1}. ${user.email} - Roles atuais: [${roles}]`);
    });
    
    console.log('\n⚠️  ATENÇÃO: Este script adicionará role ALUNO a TODOS os usuários listados.');
    console.log('Isso pode não ser desejado se alguns usuários NÃO devem ser alunos.\n');
    
    // Adicionar role ALUNO
    let adicionados = 0;
    let erros = 0;
    
    for (const user of usuariosParaAtualizar) {
      try {
        // Verificar se já existe (evitar duplicatas)
        const jaTemRole = await prisma.userRole_.findUnique({
          where: {
            userId_role: {
              userId: user.id,
              role: 'ALUNO'
            }
          }
        });
        
        if (!jaTemRole) {
          await prisma.userRole_.create({
            data: {
              userId: user.id,
              role: 'ALUNO',
              instituicaoId: user.instituicaoId
            }
          });
          adicionados++;
          console.log(`✅ Role ALUNO adicionada para ${user.email}`);
        }
      } catch (error: any) {
        erros++;
        console.error(`❌ Erro ao adicionar role para ${user.email}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Concluído!`);
    console.log(`   Adicionados: ${adicionados}`);
    console.log(`   Erros: ${erros}`);
    
  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
adicionarRoleAluno();

