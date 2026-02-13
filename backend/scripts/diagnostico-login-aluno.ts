/**
 * Script de Diagnóstico - Login de Aluno
 * 
 * Verifica possíveis problemas que impedem login de alunos:
 * 1. Aluno existe no banco?
 * 2. Aluno tem senha configurada?
 * 3. Senha está no formato bcrypt?
 * 4. Aluno tem role ALUNO?
 * 5. Instituição associada?
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function diagnosticarLoginAluno() {
  try {
    console.log('\n=== DIAGNÓSTICO DE LOGIN DE ALUNO ===\n');
    
    const email = await question('Digite o email do aluno: ');
    
    if (!email) {
      console.log('❌ Email não fornecido');
      rl.close();
      return;
    }
    
    const emailNormalizado = email.toLowerCase().trim();
    
    // 1. Verificar se usuário existe
    console.log('\n1️⃣ Verificando se usuário existe...');
    const user = await prisma.user.findUnique({
      where: { email: emailNormalizado },
      include: {
        roles: true,
        instituicao: true
      }
    });
    
    if (!user) {
      console.log('❌ USUÁRIO NÃO ENCONTRADO no banco de dados');
      console.log(`   Email procurado: ${emailNormalizado}`);
      console.log('\n💡 SOLUÇÃO: Criar o usuário primeiro via /api/users');
      rl.close();
      return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.nomeCompleto}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Instituição ID: ${user.instituicaoId || 'NÃO DEFINIDA'}`);
    console.log(`   Instituição: ${user.instituicao?.nome || 'NÃO ENCONTRADA'}`);
    
    // 2. Verificar senha
    console.log('\n2️⃣ Verificando senha...');
    if (!user.password || user.password.trim() === '') {
      console.log('❌ PROBLEMA: Usuário NÃO TEM SENHA cadastrada');
      console.log('\n💡 SOLUÇÃO: Definir senha via API de atualização de senha ou redefinição');
      rl.close();
      return;
    }
    
    console.log('✅ Senha existe');
    
    // 3. Verificar formato bcrypt
    console.log('\n3️⃣ Verificando formato da senha...');
    if (!user.password.startsWith('$2')) {
      console.log('❌ PROBLEMA: Senha NÃO está no formato bcrypt');
      console.log(`   Formato atual: ${user.password.substring(0, 20)}...`);
      console.log('\n💡 SOLUÇÃO: Senha precisa ser redefinida com bcrypt.hash()');
      rl.close();
      return;
    }
    
    console.log('✅ Senha está no formato bcrypt correto');
    console.log(`   Formato: ${user.password.substring(0, 7)}...`);
    
    // 4. Verificar roles
    console.log('\n4️⃣ Verificando roles...');
    const roles = user.roles.map(r => r.role);
    
    if (roles.length === 0) {
      console.log('❌ PROBLEMA CRÍTICO: Usuário NÃO TEM NENHUMA ROLE');
      console.log('\n💡 SOLUÇÃO: Adicionar role ALUNO via banco de dados ou API');
      
      const resposta = await question('\nDeseja adicionar role ALUNO agora? (s/n): ');
      if (resposta.toLowerCase() === 's') {
        await prisma.userRole_.create({
          data: {
            userId: user.id,
            role: 'ALUNO',
            instituicaoId: user.instituicaoId
          }
        });
        console.log('✅ Role ALUNO adicionada com sucesso!');
      }
      rl.close();
      return;
    }
    
    console.log(`✅ Usuário tem ${roles.length} role(s):`);
    roles.forEach(role => {
      console.log(`   - ${role}`);
    });
    
    const temRoleAluno = roles.includes('ALUNO');
    if (!temRoleAluno) {
      console.log('\n⚠️  ATENÇÃO: Usuário NÃO tem role ALUNO');
      console.log('\n💡 SOLUÇÃO: Adicionar role ALUNO');
      
      const resposta = await question('\nDeseja adicionar role ALUNO agora? (s/n): ');
      if (resposta.toLowerCase() === 's') {
        await prisma.userRole_.create({
          data: {
            userId: user.id,
            role: 'ALUNO',
            instituicaoId: user.instituicaoId
          }
        });
        console.log('✅ Role ALUNO adicionada com sucesso!');
      }
    } else {
      console.log('\n✅ Role ALUNO encontrada!');
    }
    
    // 5. Resumo
    console.log('\n=== RESUMO DO DIAGNÓSTICO ===');
    console.log('✅ Usuário existe');
    console.log('✅ Senha configurada e no formato correto');
    console.log(temRoleAluno ? '✅ Role ALUNO presente' : '❌ Role ALUNO ausente');
    console.log(user.instituicaoId ? '✅ Instituição associada' : '⚠️  Instituição não associada');
    
    if (temRoleAluno && user.password && user.password.startsWith('$2')) {
      console.log('\n✅ TUDO PARECE CORRETO!');
      console.log('\n💡 Se o login ainda falhar, verifique:');
      console.log('   1. A senha digitada está correta?');
      console.log('   2. A conta está bloqueada? (verificar login_attempts)');
      console.log('   3. Há logs de erro no servidor?');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERRO durante diagnóstico:', error.message);
    console.error(error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Executar diagnóstico
diagnosticarLoginAluno();

