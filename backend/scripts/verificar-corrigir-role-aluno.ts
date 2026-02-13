/**
 * Script para verificar e corrigir alunos sem role ALUNO
 * 
 * Este script:
 * 1. Lista todos os usuários que deveriam ser alunos mas não têm role ALUNO
 * 2. Pergunta se deseja adicionar a role ALUNO a esses usuários
 * 3. Adiciona a role ALUNO aos usuários identificados
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Interface para readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🔍 Verificando alunos sem role ALUNO...\n');

  try {
    // Buscar todos os usuários
    const allUsers = await prisma.user.findMany({
      include: {
        roles: true,
        matriculas: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Total de usuários no sistema: ${allUsers.length}\n`);

    // Identificar usuários que parecem ser alunos mas não têm role ALUNO
    // Critérios:
    // 1. Tem matrícula (provavelmente é aluno)
    // 2. OU tem statusAluno definido
    // 3. E não tem role ALUNO
    const usuariosSemRoleAluno = allUsers.filter((user) => {
      const temMatricula = user.matriculas && user.matriculas.length > 0;
      const temStatusAluno = user.statusAluno && user.statusAluno !== null;
      const temRoleAluno = user.roles.some((r) => r.role === 'ALUNO');
      const temOutrasRoles = user.roles.length > 0;

      // Se tem matrícula OU statusAluno, mas não tem role ALUNO
      return (temMatricula || temStatusAluno) && !temRoleAluno;
    });

    if (usuariosSemRoleAluno.length === 0) {
      console.log('✅ Todos os alunos já possuem a role ALUNO!\n');
      
      // Mostrar estatísticas
      const usuariosComRoleAluno = allUsers.filter((user) =>
        user.roles.some((r) => r.role === 'ALUNO')
      );
      console.log(`📈 Estatísticas:`);
      console.log(`   - Usuários com role ALUNO: ${usuariosComRoleAluno.length}`);
      console.log(`   - Total de usuários: ${allUsers.length}\n`);
      
      await prisma.$disconnect();
      rl.close();
      return;
    }

    console.log(`⚠️  Encontrados ${usuariosSemRoleAluno.length} usuário(s) sem role ALUNO:\n`);

    // Listar usuários
    usuariosSemRoleAluno.forEach((user, index) => {
      const rolesAtuais = user.roles.map((r) => r.role).join(', ') || 'Nenhuma';
      const temMatricula = user.matriculas && user.matriculas.length > 0;
      const statusAluno = user.statusAluno || 'Não definido';

      console.log(`${index + 1}. ${user.nomeCompleto} (${user.email})`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Status Aluno: ${statusAluno}`);
      console.log(`   - Tem Matrícula: ${temMatricula ? 'Sim' : 'Não'}`);
      console.log(`   - Roles Atuais: ${rolesAtuais}`);
      console.log(`   - Instituição ID: ${user.instituicaoId || 'Não definido'}`);
      console.log('');
    });

    // Perguntar se deseja corrigir
    const resposta = await question(
      '❓ Deseja adicionar a role ALUNO a estes usuários? (s/n): '
    );

    if (resposta.toLowerCase() !== 's' && resposta.toLowerCase() !== 'sim') {
      console.log('\n❌ Operação cancelada.');
      await prisma.$disconnect();
      rl.close();
      return;
    }

    console.log('\n🔄 Adicionando role ALUNO...\n');

    let sucesso = 0;
    let erros = 0;

    for (const user of usuariosSemRoleAluno) {
      try {
        // Verificar se já tem role ALUNO (dupla verificação)
        const roleExistente = await prisma.userRole_.findFirst({
          where: {
            userId: user.id,
            role: 'ALUNO',
          },
        });

        if (roleExistente) {
          console.log(`⏭️  ${user.email} já possui role ALUNO, pulando...`);
          continue;
        }

        // Adicionar role ALUNO
        await prisma.userRole_.create({
          data: {
            userId: user.id,
            role: 'ALUNO',
            instituicaoId: user.instituicaoId,
          },
        });

        console.log(`✅ Role ALUNO adicionada: ${user.email}`);
        sucesso++;
      } catch (error: any) {
        console.error(`❌ Erro ao adicionar role ALUNO para ${user.email}:`, error.message);
        erros++;
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`   - ✅ Sucesso: ${sucesso}`);
    console.log(`   - ❌ Erros: ${erros}`);
    console.log(`   - 📝 Total processado: ${usuariosSemRoleAluno.length}\n`);

    // Verificar novamente
    const verificacaoFinal = await prisma.user.findMany({
      where: {
        OR: [
          { matriculas: { some: {} } },
          { statusAluno: { not: null } },
        ],
      },
      include: {
        roles: true,
      },
    });

    const aindaSemRole = verificacaoFinal.filter(
      (u) => !u.roles.some((r) => r.role === 'ALUNO')
    );

    if (aindaSemRole.length === 0) {
      console.log('✅ Todos os alunos agora possuem a role ALUNO!\n');
    } else {
      console.log(`⚠️  Ainda existem ${aindaSemRole.length} usuário(s) sem role ALUNO.\n`);
    }

    await prisma.$disconnect();
    rl.close();
  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    await prisma.$disconnect();
    rl.close();
    process.exit(1);
  }
}

main();

