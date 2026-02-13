/**
 * Script para criar duas instituições de Ensino Superior
 * com cores diferentes para testar multi-tenant
 */

import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';
import { getDefaultColorsSuperior } from '../src/utils/defaultColors.js';

async function main() {
  console.log('🚀 Criando duas instituições de Ensino Superior...\n');

  // Cores personalizadas para cada instituição
  const coresInstituicao1 = {
    corPrimaria: '#1E40AF',      // Azul institucional padrão
    corSecundaria: '#64748B',    // Cinza elegante
    corTerciaria: '#F1F5F9',     // Cinza claro
  };

  const coresInstituicao2 = {
    corPrimaria: '#7C3AED',      // Roxo institucional (diferente)
    corSecundaria: '#8B5CF6',    // Roxo médio
    corTerciaria: '#F3E8FF',     // Roxo muito claro
  };

  try {
    // Instituição 1: Universidade Azul
    console.log('📚 Criando Instituição 1: Universidade Azul...');
    const instituicao1 = await prisma.$transaction(async (tx) => {
      const inst = await tx.instituicao.create({
        data: {
          nome: 'Universidade Azul',
          subdominio: 'universidade-azul',
          tipoInstituicao: 'UNIVERSIDADE',
          tipoAcademico: 'SUPERIOR',
          emailContato: 'contato@universidade-azul.edu',
          telefone: '+244 923 123 456',
          endereco: 'Luanda, Angola',
          status: 'Ativo',
        },
      });

      const senhaHash = await bcrypt.hash('admin123', 10);
      const admin = await tx.user.create({
        data: {
          email: 'admin@universidade-azul.edu',
          password: senhaHash,
          nomeCompleto: 'Administrador Universidade Azul',
          instituicaoId: inst.id,
        },
      });

      await tx.userRole_.create({
        data: {
          userId: admin.id,
          role: 'ADMIN',
          instituicaoId: inst.id,
        },
      });

      await tx.configuracaoInstituicao.create({
        data: {
          instituicaoId: inst.id,
          nomeInstituicao: 'Universidade Azul',
          tipoAcademico: 'SUPERIOR',
          corPrimaria: coresInstituicao1.corPrimaria,
          corSecundaria: coresInstituicao1.corSecundaria,
          corTerciaria: coresInstituicao1.corTerciaria,
        },
      });

      return { instituicao: inst, admin };
    });

    console.log('✅ Instituição 1 criada:');
    console.log(`   ID: ${instituicao1.instituicao.id}`);
    console.log(`   Nome: ${instituicao1.instituicao.nome}`);
    console.log(`   Subdomínio: ${instituicao1.instituicao.subdominio}`);
    console.log(`   Email Admin: ${instituicao1.admin.email}`);
    console.log(`   Senha: admin123`);
    console.log(`   Cores: Primária ${coresInstituicao1.corPrimaria}, Secundária ${coresInstituicao1.corSecundaria}\n`);

    // Instituição 2: Universidade Roxa
    console.log('📚 Criando Instituição 2: Universidade Roxa...');
    const instituicao2 = await prisma.$transaction(async (tx) => {
      const inst = await tx.instituicao.create({
        data: {
          nome: 'Universidade Roxa',
          subdominio: 'universidade-roxa',
          tipoInstituicao: 'UNIVERSIDADE',
          tipoAcademico: 'SUPERIOR',
          emailContato: 'contato@universidade-roxa.edu',
          telefone: '+244 923 789 012',
          endereco: 'Luanda, Angola',
          status: 'Ativo',
        },
      });

      const senhaHash = await bcrypt.hash('admin123', 10);
      const admin = await tx.user.create({
        data: {
          email: 'admin@universidade-roxa.edu',
          password: senhaHash,
          nomeCompleto: 'Administrador Universidade Roxa',
          instituicaoId: inst.id,
        },
      });

      await tx.userRole_.create({
        data: {
          userId: admin.id,
          role: 'ADMIN',
          instituicaoId: inst.id,
        },
      });

      await tx.configuracaoInstituicao.create({
        data: {
          instituicaoId: inst.id,
          nomeInstituicao: 'Universidade Roxa',
          tipoAcademico: 'SUPERIOR',
          corPrimaria: coresInstituicao2.corPrimaria,
          corSecundaria: coresInstituicao2.corSecundaria,
          corTerciaria: coresInstituicao2.corTerciaria,
        },
      });

      return { instituicao: inst, admin };
    });

    console.log('✅ Instituição 2 criada:');
    console.log(`   ID: ${instituicao2.instituicao.id}`);
    console.log(`   Nome: ${instituicao2.instituicao.nome}`);
    console.log(`   Subdomínio: ${instituicao2.instituicao.subdominio}`);
    console.log(`   Email Admin: ${instituicao2.admin.email}`);
    console.log(`   Senha: admin123`);
    console.log(`   Cores: Primária ${coresInstituicao2.corPrimaria}, Secundária ${coresInstituicao2.corSecundaria}\n`);

    console.log('✨ Instituições criadas com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('   Instituição 1: Universidade Azul (cores azuis)');
    console.log('   Instituição 2: Universidade Roxa (cores roxas)');
    console.log('\n🔐 Credenciais (ambas):');
    console.log('   Email: admin@universidade-[azul|roxa].edu');
    console.log('   Senha: admin123');

  } catch (error: any) {
    console.error('❌ Erro ao criar instituições:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

