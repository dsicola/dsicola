#!/usr/bin/env npx tsx
/**
 * TESTE: Alterar senha via perfil (Minha conta → Meu Perfil → Alterar Senha)
 *
 * Fluxo:
 * 1. Login com credenciais existentes
 * 2. PUT /auth/password com senha atual e nova senha
 * 3. Verificar sucesso da alteração
 * 4. Login com nova senha para confirmar
 * 5. Restaurar senha original
 *
 * Uso: npx tsx scripts/test-perfil-alterar-senha.ts
 * Ou: TEST_EMAIL=user@email.com TEST_PASSWORD=senha_atual npx tsx scripts/test-perfil-alterar-senha.ts
 * Ou: TEST_PROFESSOR_EMAIL=prof@email.com (usa Professor@123 e professor do banco)
 */

import * as readline from 'readline';
import axios from 'axios';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_EMAIL || process.env.TEST_PROFESSOR_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD || process.env.TEST_PROFESSOR_PASSWORD;

const SENHA_SETUP = 'Professor@123'; // Senha usada no modo --auto
const SENHA_NOVA = 'NovaSenha@123'; // Senha forte para teste

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function setupProfessor(): Promise<{ email: string; password: string }> {
  const professor = await prisma.professor.findFirst({
    include: { user: { select: { email: true } } },
  });
  if (!professor?.user?.email) {
    throw new Error('Nenhum professor encontrado. Crie um com: npx tsx scripts/criar-professor.ts <email>');
  }
  const hash = await bcrypt.hash(SENHA_SETUP, 10);
  await prisma.user.update({
    where: { id: professor.userId },
    data: { password: hash, mustChangePassword: false },
  });
  await prisma.$disconnect();
  return { email: professor.user.email, password: SENHA_SETUP };
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Alterar senha via perfil (Minha conta → Meu Perfil)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  let email = TEST_EMAIL;
  let password = TEST_PASSWORD;

  if (process.argv.includes('--auto') || process.argv.includes('-a')) {
    console.log('Modo --auto: configurando professor com senha Professor@123...');
    const setup = await setupProfessor();
    email = setup.email;
    password = setup.password;
    console.log(`✅ Usando ${email}\n`);
  } else if (!email || !password) {
    email = (await question('Email do usuário: '))?.trim() || '';
    password = (await question('Senha atual: '))?.trim() || '';
  }

  if (!email || !password) {
    console.log('❌ Email e senha são obrigatórios.');
    rl.close();
    process.exit(1);
  }

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // --- 1. LOGIN ---
  console.log('\n1. Login com credenciais atuais...');
  const loginRes = await api.post('/auth/login', { email, password });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.log('⚠️  Usuário precisa trocar senha obrigatória primeiro.');
    rl.close();
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    rl.close();
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`✅ Login OK - ${user?.nomeCompleto || user?.email}`);

  // --- 2. ALTERAR SENHA via PUT /auth/password ---
  console.log('\n2. Alterar senha (PUT /auth/password)...');
  const updateRes = await api.put('/auth/password', {
    currentPassword: password,
    newPassword: SENHA_NOVA,
  });

  if (updateRes.status !== 200) {
    console.log('❌ Falha ao alterar senha:', updateRes.data?.message || updateRes.statusText);
    console.log('   Resposta:', JSON.stringify(updateRes.data, null, 2));
    rl.close();
    process.exit(1);
  }

  console.log(`✅ Senha alterada: ${updateRes.data?.message || 'OK'}`);

  // --- 3. LOGIN com nova senha ---
  console.log('\n3. Verificar login com nova senha...');
  const loginNovoRes = await api.post('/auth/login', { email, password: SENHA_NOVA });

  if (loginNovoRes.status !== 200 || !loginNovoRes.data?.accessToken) {
    console.log('❌ Login com nova senha falhou:', loginNovoRes.data?.message || loginNovoRes.statusText);
    rl.close();
    process.exit(1);
  }

  console.log(`✅ Login com nova senha OK`);

  // --- 4. (Opcional) Restaurar senha original ---
  const token2 = loginNovoRes.data.accessToken;
  api.defaults.headers.common['Authorization'] = `Bearer ${token2}`;

  console.log('\n4. Restaurar senha original...');
  const restoreRes = await api.put('/auth/password', {
    currentPassword: SENHA_NOVA,
    newPassword: password,
  });

  if (restoreRes.status !== 200) {
    console.log('⚠️  Não foi possível restaurar senha original (não crítico):', restoreRes.data?.message);
  } else {
    console.log(`✅ Senha original restaurada`);
  }

  rl.close();

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE CONCLUÍDO - Fluxo de alterar senha via perfil OK');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  rl.close();
  process.exit(1);
});
