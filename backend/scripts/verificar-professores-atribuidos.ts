import prisma from '../src/lib/prisma.js';

async function verificarProfessoresAtribuidos() {
  try {
    console.log('🔍 Verificando professores e suas atribuições...\n');

    // 1. Buscar todos os professores (tabela professores)
    const professores = await prisma.professor.findMany({
      include: {
        user: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        user: {
          nomeCompleto: 'asc',
        },
      },
    });

    // 2. Buscar usuários com role PROFESSOR que podem não ter registro na tabela professores
    const usuariosProfessores = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: 'PROFESSOR',
          },
        },
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        roles: {
          select: {
            role: true,
          },
        },
      },
      orderBy: {
        nomeCompleto: 'asc',
      },
    });

    console.log(`📊 Total de professores na tabela 'professores': ${professores.length}`);
    console.log(`📊 Total de usuários com role PROFESSOR: ${usuariosProfessores.length}\n`);

    if (professores.length === 0 && usuariosProfessores.length === 0) {
      console.log('❌ Nenhum professor encontrado no banco de dados.');
      return;
    }

    // Criar lista combinada de professores
    const todosProfessores = professores.map(p => ({
      id: p.id,
      userId: p.userId,
      user: p.user,
      instituicao: p.instituicao,
      temRegistroProfessor: true,
    }));

    // Adicionar usuários com role PROFESSOR que não têm registro na tabela professores
    for (const usuario of usuariosProfessores) {
      const jaExiste = professores.some(p => p.userId === usuario.id);
      if (!jaExiste) {
        todosProfessores.push({
          id: usuario.id, // Usar userId como id temporário
          userId: usuario.id,
          user: {
            id: usuario.id,
            nomeCompleto: usuario.nomeCompleto,
            email: usuario.email,
          },
          instituicao: usuario.instituicao || { id: 'N/A', nome: 'N/A' },
          temRegistroProfessor: false,
        });
      }
    }

    // 3. Para cada professor, verificar planos de ensino com turma e disciplina
    const resultados = [];

    for (const professor of todosProfessores) {
      // Buscar planos de ensino do professor que têm turma e disciplina
      const planosComTurma = await prisma.planoEnsino.findMany({
        where: {
          professorId: professor.userId, // professorId no PlanoEnsino é User.id
          turmaId: { not: null }, // disciplinaId é obrigatório, não precisa verificar
        },
        include: {
          disciplina: {
            select: {
              id: true,
              nome: true,
              codigo: true,
            },
          },
          turma: {
            select: {
              id: true,
              nome: true,
            },
          },
          curso: {
            select: {
              id: true,
              nome: true,
            },
          },
          anoLetivoRef: {
            select: {
              id: true,
              ano: true,
              status: true,
            },
          },
        },
        orderBy: {
          anoLetivo: 'desc',
        },
      });

      // Buscar planos sem turma (apenas disciplina)
      const planosSemTurma = await prisma.planoEnsino.findMany({
        where: {
          professorId: professor.userId,
          turmaId: null, // disciplinaId é obrigatório, não precisa verificar
        },
        include: {
          disciplina: {
            select: {
              id: true,
              nome: true,
              codigo: true,
            },
          },
          curso: {
            select: {
              id: true,
              nome: true,
            },
          },
          anoLetivoRef: {
            select: {
              id: true,
              ano: true,
              status: true,
            },
          },
        },
        orderBy: {
          anoLetivo: 'desc',
        },
      });

      resultados.push({
        professor,
        planosComTurma,
        planosSemTurma,
      });
    }

    // 3. Exibir resultados
    console.log('='.repeat(80));
    console.log('RESULTADOS DA VERIFICAÇÃO');
    console.log('='.repeat(80));
    console.log();

    let professoresComAtribuicao = 0;
    let professoresSemAtribuicao = 0;

    for (const resultado of resultados) {
      const { professor, planosComTurma, planosSemTurma } = resultado;
      const totalAtribuicoes = planosComTurma.length + planosSemTurma.length;

      if (totalAtribuicoes > 0) {
        professoresComAtribuicao++;
      } else {
        professoresSemAtribuicao++;
      }

      console.log(`👤 Professor: ${professor.user.nomeCompleto}`);
      console.log(`   ID: ${professor.id}`);
      console.log(`   User ID: ${professor.userId}`);
      console.log(`   Email: ${professor.user.email || 'N/A'}`);
      console.log(`   Instituição: ${professor.instituicao.nome}`);
      console.log(`   Tem registro na tabela 'professores': ${professor.temRegistroProfessor ? 'Sim' : 'Não'}`);
      console.log();

      if (planosComTurma.length > 0) {
        console.log(`   ✅ ATRIBUIÇÕES COM TURMA (${planosComTurma.length}):`);
        planosComTurma.forEach((plano, index) => {
          console.log(`      ${index + 1}. ${plano.disciplina.nome} (${plano.disciplina.codigo || 'N/A'})`);
          console.log(`         Turma: ${plano.turma?.nome || 'N/A'}`);
          console.log(`         Curso: ${plano.curso?.nome || 'N/A'}`);
          console.log(`         Ano Letivo: ${plano.anoLetivo} (${plano.anoLetivoRef.status})`);
          console.log(`         Semestre: ${plano.semestre || 'N/A'}`);
          console.log(`         Estado: ${plano.estado}`);
          console.log(`         Bloqueado: ${plano.bloqueado ? 'Sim' : 'Não'}`);
          console.log();
        });
      }

      if (planosSemTurma.length > 0) {
        console.log(`   ⚠️  ATRIBUIÇÕES SEM TURMA (${planosSemTurma.length}):`);
        planosSemTurma.forEach((plano, index) => {
          console.log(`      ${index + 1}. ${plano.disciplina.nome} (${plano.disciplina.codigo || 'N/A'})`);
          console.log(`         Curso: ${plano.curso?.nome || 'N/A'}`);
          console.log(`         Ano Letivo: ${plano.anoLetivo} (${plano.anoLetivoRef.status})`);
          console.log(`         Semestre: ${plano.semestre || 'N/A'}`);
          console.log(`         Estado: ${plano.estado}`);
          console.log(`         Bloqueado: ${plano.bloqueado ? 'Sim' : 'Não'}`);
          console.log();
        });
      }

      if (totalAtribuicoes === 0) {
        console.log(`   ❌ Nenhuma atribuição encontrada`);
        console.log();
      }

      console.log('-'.repeat(80));
      console.log();
    }

    // 4. Resumo final
    console.log('='.repeat(80));
    console.log('RESUMO');
    console.log('='.repeat(80));
    console.log(`Total de professores (tabela 'professores'): ${professores.length}`);
    console.log(`Total de usuários com role PROFESSOR: ${usuariosProfessores.length}`);
    console.log(`Total de professores únicos: ${todosProfessores.length}`);
    console.log(`Professores com atribuições: ${professoresComAtribuicao}`);
    console.log(`Professores sem atribuições: ${professoresSemAtribuicao}`);
    console.log();

    const totalPlanosComTurma = resultados.reduce(
      (sum, r) => sum + r.planosComTurma.length,
      0
    );
    const totalPlanosSemTurma = resultados.reduce(
      (sum, r) => sum + r.planosSemTurma.length,
      0
    );

    console.log(`Total de atribuições COM turma: ${totalPlanosComTurma}`);
    console.log(`Total de atribuições SEM turma: ${totalPlanosSemTurma}`);
    console.log(`Total de atribuições: ${totalPlanosComTurma + totalPlanosSemTurma}`);
    console.log();

  } catch (error) {
    console.error('❌ Erro ao verificar professores:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
verificarProfessoresAtribuidos()
  .then(() => {
    console.log('✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

