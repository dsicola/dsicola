/**
 * Script para Testar Login de Aluno Diretamente
 * 
 * Testa o login sem passar pelo frontend para identificar problemas
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testarLogin() {
  try {
    console.log('\n=== TESTE DE LOGIN DE ALUNO ===\n');
    
    const email = await question('Digite o email do aluno: ');
    const password = await question('Digite a senha do aluno: ');
    
    if (!email || !password) {
      console.log('❌ Email e senha são obrigatórios');
      rl.close();
      return;
    }
    
    const emailNormalizado = email.toLowerCase().trim();
    
    console.log('\n🔍 Verificando usuário...');
    
    // 1. Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: emailNormalizado },
      include: {
        roles: true,
        instituicao: true
      }
    });
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      console.log(`   Email procurado: ${emailNormalizado}`);
      rl.close();
      return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.nomeCompleto}`);
    console.log(`   Email: ${user.email}`);
    
    // 2. Verificar senha
    console.log('\n🔍 Verificando senha...');
    
    if (!user.password || user.password.trim() === '') {
      console.log('❌ Usuário não tem senha cadastrada');
      rl.close();
      return;
    }
    
    if (!user.password.startsWith('$2')) {
      console.log('❌ Senha não está no formato bcrypt');
      console.log(`   Formato atual: ${user.password.substring(0, 20)}...`);
      rl.close();
      return;
    }
    
    console.log('✅ Senha existe e está no formato bcrypt');
    
    // 3. Comparar senha
    console.log('\n🔍 Comparando senha...');
    try {
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        console.log('❌ SENHA INCORRETA');
        console.log('   A senha digitada não corresponde à senha no banco');
        rl.close();
        return;
      }
      
      console.log('✅ Senha correta!');
    } catch (error: any) {
      console.log('❌ Erro ao comparar senha:', error.message);
      rl.close();
      return;
    }
    
    // 4. Verificar roles
    console.log('\n🔍 Verificando roles...');
    const roles = user.roles.map(r => r.role);
    
    if (roles.length === 0) {
      console.log('❌ PROBLEMA: Usuário não tem nenhuma role');
      console.log('   Isso impedirá o login mesmo com senha correta!');
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
      console.log('   O login pode funcionar, mas o redirecionamento pode falhar');
    } else {
      console.log('\n✅ Role ALUNO encontrada!');
    }
    
    // 5. Verificar instituição
    console.log('\n🔍 Verificando instituição...');
    if (!user.instituicaoId) {
      console.log('⚠️  ATENÇÃO: Usuário não tem instituição associada');
    } else {
      console.log(`✅ Instituição associada: ${user.instituicao?.nome || user.instituicaoId}`);
    }
    
    // 6. Resumo final
    console.log('\n=== RESUMO DO TESTE ===');
    console.log('✅ Usuário existe');
    console.log('✅ Senha correta');
    console.log(temRoleAluno ? '✅ Role ALUNO presente' : '❌ Role ALUNO ausente');
    console.log(user.instituicaoId ? '✅ Instituição associada' : '⚠️  Instituição não associada');
    
    if (temRoleAluno && user.password && user.password.startsWith('$2')) {
      console.log('\n✅ TUDO PARECE CORRETO!');
      console.log('\n💡 Se o login ainda falhar no frontend, verifique:');
      console.log('   1. O backend está rodando?');
      console.log('   2. A URL da API está correta? (VITE_API_URL)');
      console.log('   3. Há erros de CORS?');
      console.log('   4. Há logs de erro no servidor backend?');
      console.log('   5. A conta está bloqueada? (login_attempts)');
    }
    
  } catch (error: any) {
    console.error('\n❌ ERRO durante teste:', error.message);
    console.error(error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Executar teste
testarLogin();

