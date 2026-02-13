/**
 * Script de Diagnóstico Multi-Tenant
 * 
 * Este script verifica:
 * 1. Se os dados têm instituicao_id preenchido
 * 2. Se o filtro está funcionando corretamente
 * 3. Quantos registros existem por instituição
 */

import prisma from '../src/lib/prisma.js';

async function diagnosticarMultiTenant() {
  console.log('🔍 DIAGNÓSTICO MULTI-TENANT - DSICOLA\n');
  console.log('='.repeat(80));

  try {
    // 1. Verificar instituições
    console.log('\n📊 1. INSTITUIÇÕES:');
    const instituicoes = await prisma.instituicao.findMany({
      select: {
        id: true,
        nome: true,
        subdominio: true,
      },
      orderBy: { nome: 'asc' },
    });
    console.log(`   Total de instituições: ${instituicoes.length}`);
    instituicoes.forEach(inst => {
      console.log(`   - ${inst.nome} (${inst.subdominio}): ${inst.id}`);
    });

    if (instituicoes.length === 0) {
      console.log('   ⚠️  NENHUMA INSTITUIÇÃO ENCONTRADA!');
      return;
    }

    // 2. Verificar usuários (estudantes e professores)
    console.log('\n👥 2. USUÁRIOS:');
    const totalUsuarios = await prisma.user.count();
    const usuariosSemInst = await prisma.user.count({
      where: { instituicaoId: null },
    });
    const usuariosComInst = await prisma.user.count({
      where: { instituicaoId: { not: null } },
    });

    console.log(`   Total: ${totalUsuarios}`);
    console.log(`   Com instituicao_id: ${usuariosComInst}`);
    console.log(`   Sem instituicao_id: ${usuariosSemInst} ⚠️`);

    // Por instituição
    for (const inst of instituicoes) {
      const count = await prisma.user.count({
        where: { instituicaoId: inst.id },
      });
      console.log(`   - ${inst.nome}: ${count} usuários`);
    }

    // 3. Verificar cursos
    console.log('\n📚 3. CURSOS:');
    const totalCursos = await prisma.curso.count();
    const cursosSemInst = await prisma.curso.count({
      where: { instituicaoId: null },
    });
    const cursosComInst = await prisma.curso.count({
      where: { instituicaoId: { not: null } },
    });

    console.log(`   Total: ${totalCursos}`);
    console.log(`   Com instituicao_id: ${cursosComInst}`);
    console.log(`   Sem instituicao_id: ${cursosSemInst} ⚠️`);

    for (const inst of instituicoes) {
      const count = await prisma.curso.count({
        where: { instituicaoId: inst.id },
      });
      console.log(`   - ${inst.nome}: ${count} cursos`);
    }

    // 4. Verificar turmas
    console.log('\n🏫 4. TURMAS:');
    const totalTurmas = await prisma.turma.count();
    const turmasSemInst = await prisma.turma.count({
      where: { instituicaoId: null },
    });
    const turmasComInst = await prisma.turma.count({
      where: { instituicaoId: { not: null } },
    });

    console.log(`   Total: ${totalTurmas}`);
    console.log(`   Com instituicao_id: ${turmasComInst}`);
    console.log(`   Sem instituicao_id: ${turmasSemInst} ⚠️`);

    for (const inst of instituicoes) {
      const count = await prisma.turma.count({
        where: { instituicaoId: inst.id },
      });
      console.log(`   - ${inst.nome}: ${count} turmas`);
    }

    // 5. Verificar disciplinas
    console.log('\n📖 5. DISCIPLINAS:');
    const totalDisciplinas = await prisma.disciplina.count();
    const disciplinasSemInst = await prisma.disciplina.count({
      where: { instituicaoId: null },
    });
    const disciplinasComInst = await prisma.disciplina.count({
      where: { instituicaoId: { not: null } },
    });

    console.log(`   Total: ${totalDisciplinas}`);
    console.log(`   Com instituicao_id: ${disciplinasComInst}`);
    console.log(`   Sem instituicao_id: ${disciplinasSemInst} ⚠️`);

    for (const inst of instituicoes) {
      const count = await prisma.disciplina.count({
        where: { instituicaoId: inst.id },
      });
      console.log(`   - ${inst.nome}: ${count} disciplinas`);
    }

    // 6. Verificar matrículas
    console.log('\n📝 6. MATRÍCULAS:');
    const totalMatriculas = await prisma.matricula.count();
    
    // Matrículas através de alunos com instituicao_id
    const alunosComInst = await prisma.user.findMany({
      where: { instituicaoId: { not: null } },
      select: { id: true, instituicaoId: true },
    });

    const matriculasViaAluno: { [instId: string]: number } = {};
    for (const aluno of alunosComInst) {
      const count = await prisma.matricula.count({
        where: { alunoId: aluno.id },
      });
      if (aluno.instituicaoId) {
        matriculasViaAluno[aluno.instituicaoId] = 
          (matriculasViaAluno[aluno.instituicaoId] || 0) + count;
      }
    }

    console.log(`   Total: ${totalMatriculas}`);
    
    for (const inst of instituicoes) {
      const count = matriculasViaAluno[inst.id] || 0;
      console.log(`   - ${inst.nome}: ${count} matrículas (via alunos)`);
    }

    // 7. Verificar mensalidades
    console.log('\n💰 7. MENSALIDADES:');
    const totalMensalidades = await prisma.mensalidade.count();
    
    // Mensalidades através de alunos
    const mensalidadesViaAluno: { [instId: string]: number } = {};
    for (const aluno of alunosComInst) {
      const count = await prisma.mensalidade.count({
        where: { alunoId: aluno.id },
      });
      if (aluno.instituicaoId) {
        mensalidadesViaAluno[aluno.instituicaoId] = 
          (mensalidadesViaAluno[aluno.instituicaoId] || 0) + count;
      }
    }

    console.log(`   Total: ${totalMensalidades}`);
    
    for (const inst of instituicoes) {
      const count = mensalidadesViaAluno[inst.id] || 0;
      console.log(`   - ${inst.nome}: ${count} mensalidades (via alunos)`);
    }

    // 8. Resumo de problemas
    console.log('\n⚠️  8. RESUMO DE PROBLEMAS:');
    const problemas: string[] = [];

    if (usuariosSemInst > 0) {
      problemas.push(`${usuariosSemInst} usuários sem instituicao_id`);
    }
    if (cursosSemInst > 0) {
      problemas.push(`${cursosSemInst} cursos sem instituicao_id`);
    }
    if (turmasSemInst > 0) {
      problemas.push(`${turmasSemInst} turmas sem instituicao_id`);
    }
    if (disciplinasSemInst > 0) {
      problemas.push(`${disciplinasSemInst} disciplinas sem instituicao_id`);
    }

    if (problemas.length === 0) {
      console.log('   ✅ Nenhum problema encontrado!');
    } else {
      problemas.forEach(p => console.log(`   - ${p}`));
    }

    // 9. Verificar se há dados órfãos (instituicao_id inválido)
    console.log('\n🔗 9. DADOS ÓRFÃOS (instituicao_id inválido):');
    
    const usuariosOrfaos = await prisma.user.findMany({
      where: {
        instituicaoId: { not: null },
        instituicao: null,
      },
      select: { id: true, instituicaoId: true },
      take: 5,
    });
    
    if (usuariosOrfaos.length > 0) {
      console.log(`   ⚠️  ${await prisma.user.count({ where: { instituicaoId: { not: null }, instituicao: null } })} usuários com instituicao_id inválido`);
      usuariosOrfaos.forEach(u => {
        console.log(`      - Usuário ${u.id} com instituicao_id ${u.instituicaoId} (não existe)`);
      });
    } else {
      console.log('   ✅ Nenhum dado órfão encontrado');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnóstico concluído!\n');

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
diagnosticarMultiTenant()
  .then(() => {
    console.log('Script finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });

