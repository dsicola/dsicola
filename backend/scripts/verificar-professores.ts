import prisma from '../src/lib/prisma.js';

async function verificarProfessores() {
  try {
    console.log('🔍 Verificando professores no banco de dados...\n');

    // Contar total de professores
    const totalProfessores = await prisma.professor.count();
    console.log(`📊 Total de professores na tabela 'professores': ${totalProfessores}\n`);

    // Buscar usuários com role PROFESSOR (para usar depois)
    let usuariosProfessores: Array<{
      id: string;
      nomeCompleto: string | null;
      email: string | null;
      instituicaoId: string | null;
      roles: Array<{ role: string }>;
    }> = [];

    if (totalProfessores === 0) {
      console.log('⚠️  Nenhum professor encontrado na tabela professores.\n');
      console.log('💡 Verificando usuários com role PROFESSOR...\n');
      
      // Verificar usuários com role PROFESSOR
      usuariosProfessores = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: 'PROFESSOR'
            }
          }
        },
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          instituicaoId: true,
          roles: {
            select: {
              role: true
            }
          }
        },
        take: 10 // Limitar a 10 para não sobrecarregar
      });

      console.log(`📊 Usuários com role PROFESSOR encontrados: ${usuariosProfessores.length}\n`);

      if (usuariosProfessores.length > 0) {
        console.log('📋 Primeiros usuários com role PROFESSOR:\n');
        usuariosProfessores.forEach((user, index) => {
          console.log(`${index + 1}. ${user.nomeCompleto || 'Sem nome'}`);
          console.log(`   ID: ${user.id}`);
          console.log(`   Email: ${user.email || 'Sem email'}`);
          console.log(`   Instituição ID: ${user.instituicaoId || 'Sem instituição'}`);
          console.log(`   Roles: ${user.roles.map(r => r.role).join(', ')}`);
          console.log('');
        });

        console.log('💡 Estes usuários têm role PROFESSOR mas podem não ter registro na tabela professores.');
        console.log('   Isso pode ser normal se os planos de ensino usam User.id diretamente.\n');
      } else {
        console.log('❌ Nenhum usuário com role PROFESSOR encontrado.\n');
      }
    } else {
      // Listar professores com detalhes
      const professores = await prisma.professor.findMany({
        include: {
          user: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              roles: {
                select: {
                  role: true
                }
              }
            }
          },
          instituicao: {
            select: {
              id: true,
              nome: true
            }
          },
          _count: {
            select: {
              cursos: true,
              disciplinas: true
            }
          }
        },
        take: 20 // Limitar a 20 para não sobrecarregar
      });

      console.log(`📋 Listando professores (mostrando até 20):\n`);
      
      professores.forEach((professor, index) => {
        console.log(`${index + 1}. Professor ID: ${professor.id}`);
        console.log(`   User ID: ${professor.userId}`);
        console.log(`   Nome: ${professor.user?.nomeCompleto || 'Sem nome'}`);
        console.log(`   Email: ${professor.user?.email || 'Sem email'}`);
        console.log(`   Instituição: ${professor.instituicao?.nome || 'Sem instituição'}`);
        console.log(`   Roles: ${professor.user?.roles.map(r => r.role).join(', ') || 'Sem roles'}`);
        console.log(`   Cursos vinculados: ${professor._count.cursos}`);
        console.log(`   Disciplinas vinculadas: ${professor._count.disciplinas}`);
        console.log(`   Criado em: ${professor.createdAt.toLocaleString('pt-BR')}`);
        console.log('');
      });

      if (totalProfessores > 20) {
        console.log(`... e mais ${totalProfessores - 20} professores.\n`);
      }

      // Estatísticas adicionais
      const professoresComCursos = await prisma.professor.count({
        where: {
          cursos: {
            some: {}
          }
        }
      });

      const professoresComDisciplinas = await prisma.professor.count({
        where: {
          disciplinas: {
            some: {}
          }
        }
      });

      console.log('📊 Estatísticas:\n');
      console.log(`   Professores com cursos vinculados: ${professoresComCursos}`);
      console.log(`   Professores com disciplinas vinculadas: ${professoresComDisciplinas}`);
      console.log('');
    }

    // Verificar planos de ensino vinculados a professores
    // Como professorId é obrigatório no schema, todos os planos têm professor
    const totalPlanos = await prisma.planoEnsino.count();
    
    // Verificar planos vinculados aos professores encontrados
    if (usuariosProfessores.length > 0) {
      const planosDosProfessores = await prisma.planoEnsino.count({
        where: {
          professorId: {
            in: usuariosProfessores.map(u => u.id)
          }
        }
      });
      console.log(`📚 Total de Planos de Ensino: ${totalPlanos}`);
      console.log(`📚 Planos de Ensino dos professores encontrados: ${planosDosProfessores}\n`);
    } else {
      console.log(`📚 Total de Planos de Ensino: ${totalPlanos}\n`);
    }

    console.log('✅ Verificação concluída!');
  } catch (error) {
    console.error('❌ Erro ao verificar professores:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
verificarProfessores()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });

