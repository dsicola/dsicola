/**
 * ============================================================
 * MIGRAÇÃO SIGA/SIGAE REAL - DSICOLA
 * ============================================================
 * 
 * OBJETIVO: Migrar modelo acadêmico para padrão SIGA/SIGAE REAL
 * - Professor é uma ENTIDADE própria (tabela professores)
 * - Plano de Ensino referencia professores.id (NÃO users.id)
 * - Painel do Professor consome EXCLUSIVAMENTE Plano de Ensino
 * 
 * ⚠️ O SISTEMA JÁ EXISTE.
 * ⚠️ EXISTEM DADOS EM PRODUÇÃO.
 * ⚠️ A MIGRAÇÃO DEVE SER SEGURA E CONTROLADA.
 * 
 * ============================================================
 */

import prisma from '../src/lib/prisma.js';

interface MigrationStats {
  professoresCriados: number;
  professoresExistentes: number;
  planosMigrados: number;
  planosComErro: number;
  planosTotal: number;
}

/**
 * ETAPA 1: Popular tabela professores
 * Criar registros para TODOS os usuários com role PROFESSOR
 */
async function etapa1_PopularProfessores(): Promise<{ criados: number; existentes: number }> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ETAPA 1: POPULAR TABELA PROFESSORES');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Buscar todos os usuários com role PROFESSOR
  const usuariosProfessores = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: 'PROFESSOR'
        }
      },
      instituicaoId: {
        not: null
      }
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      instituicaoId: true
    }
  });

  console.log(`📊 Usuários com role PROFESSOR encontrados: ${usuariosProfessores.length}`);

  if (usuariosProfessores.length === 0) {
    console.log('⚠️  Nenhum usuário com role PROFESSOR encontrado.');
    return { criados: 0, existentes: 0 };
  }

  let criados = 0;
  let existentes = 0;

  // Criar registros em professores para cada usuário
  for (const user of usuariosProfessores) {
    if (!user.instituicaoId) {
      console.warn(`⚠️  Usuário ${user.id} (${user.email}) não possui instituicaoId - pulando`);
      continue;
    }

    // Verificar se já existe
    const professorExistente = await prisma.professor.findFirst({
      where: {
        userId: user.id,
        instituicaoId: user.instituicaoId
      }
    });

    if (professorExistente) {
      existentes++;
      continue;
    }

    // Criar novo registro
    try {
      await prisma.professor.create({
        data: {
          userId: user.id,
          instituicaoId: user.instituicaoId
        }
      });
      criados++;
      console.log(`✅ Professor criado: ${user.nomeCompleto} (${user.email})`);
    } catch (error: any) {
      console.error(`❌ Erro ao criar professor para ${user.email}:`, error.message);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   - Professores criados: ${criados}`);
  console.log(`   - Professores já existentes: ${existentes}`);
  console.log(`   - Total: ${criados + existentes}`);

  return { criados, existentes };
}

/**
 * ETAPA 2: Migrar plano_ensino.professor_id
 * Atualizar de users.id para professores.id
 */
async function etapa2_MigrarPlanoEnsino(): Promise<{ migrados: number; comErro: number; total: number }> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ETAPA 2: MIGRAR PLANO_ENSINO.PROFESSOR_ID');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Buscar todos os planos de ensino
  const planosEnsino = await prisma.planoEnsino.findMany({
    where: {
      professorId: {
        not: null
      }
    },
    select: {
      id: true,
      professorId: true,
      instituicaoId: true,
      disciplina: {
        select: {
          nome: true
        }
      }
    }
  });

  console.log(`📊 Total de planos de ensino encontrados: ${planosEnsino.length}`);

  if (planosEnsino.length === 0) {
    console.log('⚠️  Nenhum plano de ensino encontrado.');
    return { migrados: 0, comErro: 0, total: 0 };
  }

  let migrados = 0;
  let comErro = 0;
  const erros: Array<{ planoId: string; motivo: string }> = [];

  // Migrar cada plano
  for (const plano of planosEnsino) {
    if (!plano.professorId) {
      continue;
    }

    try {
      // Verificar se professorId já é professores.id
      const professorDireto = await prisma.professor.findUnique({
        where: {
          id: plano.professorId
        }
      });

      if (professorDireto) {
        // Já está correto (professores.id)
        migrados++;
        continue;
      }

      // Tentar resolver: professorId pode ser users.id
      const user = await prisma.user.findUnique({
        where: {
          id: plano.professorId
        },
        select: {
          id: true,
          instituicaoId: true
        }
      });

      if (!user) {
        erros.push({
          planoId: plano.id,
          motivo: `User ${plano.professorId} não encontrado`
        });
        comErro++;
        continue;
      }

      // Buscar professor correspondente
      const instituicaoId = plano.instituicaoId || user.instituicaoId;
      if (!instituicaoId) {
        erros.push({
          planoId: plano.id,
          motivo: 'Instituição não identificada'
        });
        comErro++;
        continue;
      }

      const professor = await prisma.professor.findFirst({
        where: {
          userId: user.id,
          instituicaoId: instituicaoId
        }
      });

      if (!professor) {
        erros.push({
          planoId: plano.id,
          motivo: `Professor não encontrado para user ${user.id} e instituição ${instituicaoId}`
        });
        comErro++;
        continue;
      }

      // Atualizar plano_ensino.professor_id
      await prisma.planoEnsino.update({
        where: {
          id: plano.id
        },
        data: {
          professorId: professor.id
        }
      });

      migrados++;
      console.log(`✅ Plano ${plano.id} migrado: ${plano.professorId} → ${professor.id}`);
    } catch (error: any) {
      erros.push({
        planoId: plano.id,
        motivo: error.message || 'Erro desconhecido'
      });
      comErro++;
      console.error(`❌ Erro ao migrar plano ${plano.id}:`, error.message);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   - Planos migrados: ${migrados}`);
  console.log(`   - Planos com erro: ${comErro}`);
  console.log(`   - Total: ${planosEnsino.length}`);

  if (erros.length > 0) {
    console.log(`\n⚠️  Planos com erro:`);
    erros.slice(0, 10).forEach(erro => {
      console.log(`   - ${erro.planoId}: ${erro.motivo}`);
    });
    if (erros.length > 10) {
      console.log(`   ... e mais ${erros.length - 10} erros`);
    }
  }

  return { migrados, comErro, total: planosEnsino.length };
}

/**
 * ETAPA 3: Validar migração
 */
async function etapa3_ValidarMigracao(): Promise<boolean> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ETAPA 3: VALIDAR MIGRAÇÃO');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Validar 1: Todos os users com role PROFESSOR têm registro em professores
  const usuariosProfessores = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: 'PROFESSOR'
        }
      },
      instituicaoId: {
        not: null
      }
    },
    select: {
      id: true,
      instituicaoId: true
    }
  });

  let usuariosSemProfessor = 0;
  for (const user of usuariosProfessores) {
    if (!user.instituicaoId) continue;
    
    const professor = await prisma.professor.findFirst({
      where: {
        userId: user.id,
        instituicaoId: user.instituicaoId
      }
    });

    if (!professor) {
      usuariosSemProfessor++;
      console.warn(`⚠️  User ${user.id} não possui registro em professores`);
    }
  }

  // Validar 2: Todos os planos_ensino.professor_id referenciam professores.id
  const planosEnsino = await prisma.planoEnsino.findMany({
    where: {
      professorId: {
        not: null
      }
    },
    select: {
      id: true,
      professorId: true
    }
  });

  let planosComUserId = 0;
  for (const plano of planosEnsino) {
    if (!plano.professorId) continue;

    const professor = await prisma.professor.findUnique({
      where: {
        id: plano.professorId
      }
    });

    if (!professor) {
      // Verificar se é users.id
      const user = await prisma.user.findUnique({
        where: {
          id: plano.professorId
        }
      });

      if (user) {
        planosComUserId++;
        console.warn(`⚠️  Plano ${plano.id} ainda referencia users.id (${plano.professorId})`);
      }
    }
  }

  console.log(`\n📊 Validação:`);
  console.log(`   - Usuários sem professor: ${usuariosSemProfessor}`);
  console.log(`   - Planos ainda com users.id: ${planosComUserId}`);

  const sucesso = usuariosSemProfessor === 0 && planosComUserId === 0;
  
  if (sucesso) {
    console.log(`\n✅ Migração validada com sucesso!`);
  } else {
    console.log(`\n⚠️  Migração possui problemas que precisam ser corrigidos.`);
  }

  return sucesso;
}

/**
 * Função principal
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   MIGRAÇÃO SIGA/SIGAE REAL - DSICOLA                      ║');
  console.log('║   Modelo Acadêmico Institucional                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const stats: MigrationStats = {
    professoresCriados: 0,
    professoresExistentes: 0,
    planosMigrados: 0,
    planosComErro: 0,
    planosTotal: 0
  };

  try {
    // ETAPA 1: Popular professores
    const etapa1 = await etapa1_PopularProfessores();
    stats.professoresCriados = etapa1.criados;
    stats.professoresExistentes = etapa1.existentes;

    // ETAPA 2: Migrar plano_ensino
    const etapa2 = await etapa2_MigrarPlanoEnsino();
    stats.planosMigrados = etapa2.migrados;
    stats.planosComErro = etapa2.comErro;
    stats.planosTotal = etapa2.total;

    // ETAPA 3: Validar
    const validacao = await etapa3_ValidarMigracao();

    // Resumo final
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   RESUMO DA MIGRAÇÃO                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Professores:`);
    console.log(`   - Criados: ${stats.professoresCriados}`);
    console.log(`   - Já existentes: ${stats.professoresExistentes}`);
    console.log(`   - Total: ${stats.professoresCriados + stats.professoresExistentes}`);
    console.log(`\n📊 Planos de Ensino:`);
    console.log(`   - Migrados: ${stats.planosMigrados}`);
    console.log(`   - Com erro: ${stats.planosComErro}`);
    console.log(`   - Total: ${stats.planosTotal}`);
    console.log(`\n✅ Status: ${validacao ? 'MIGRAÇÃO CONCLUÍDA COM SUCESSO' : 'MIGRAÇÃO CONCLUÍDA COM AVISOS'}\n`);

    if (!validacao) {
      console.log('⚠️  ATENÇÃO: Existem problemas que precisam ser corrigidos manualmente.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ ERRO CRÍTICO NA MIGRAÇÃO:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main().catch(console.error);

