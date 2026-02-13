#!/usr/bin/env npx tsx
/**
 * Teste do fluxo de email (reset de senha, envio, etc.)
 *
 * Uso: npm run test:email-fluxo
 * Requer: Backend rodando em http://localhost:3001
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

async function test1_solicitarResetSenha() {
  console.log('\n--- 1. Solicitar reset de senha (POST /auth/reset-password) ---');
  const res = await axios.post(`${API_URL}/auth/reset-password`, {
    email: ADMIN_EMAIL,
  });
  if (res.status !== 200 || !res.data?.message) {
    throw new Error(`Falhou: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✅ Resposta:', res.data.message);
  return true;
}

async function test2_verificarEmailRegistrado() {
  console.log('\n--- 2. Verificar email RECUPERACAO_SENHA registrado ---');
  const ultimo = await prisma.emailEnviado.findFirst({
    where: { tipo: 'RECUPERACAO_SENHA' },
    orderBy: { createdAt: 'desc' },
  });
  if (!ultimo) {
    throw new Error('Nenhum email RECUPERACAO_SENHA encontrado em emails_enviados');
  }
  console.log('✅ Email registrado:', {
    destinatario: ultimo.destinatarioEmail,
    assunto: ultimo.assunto,
    status: ultimo.status,
    erro: ultimo.erro || '(nenhum)',
  });
  return ultimo;
}

async function test3_confirmarResetComToken() {
  console.log('\n--- 3. Confirmar reset com token (POST /auth/confirm-reset-password) ---');
  const token = await prisma.passwordResetToken.findFirst({
    where: { used: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!token) {
    throw new Error('Nenhum token de reset disponível. Execute o teste 1 primeiro.');
  }
  const novaSenha = 'NovaSenha@123!';
  const res = await axios.post(`${API_URL}/auth/confirm-reset-password`, {
    token: token.token,
    newPassword: novaSenha,
    confirmPassword: novaSenha,
  });
  if (res.status !== 200 || !res.data?.message) {
    throw new Error(`Falhou: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✅ Senha alterada com sucesso');
  return novaSenha;
}

async function test4_loginComNovaSenha(novaSenha: string) {
  console.log('\n--- 4. Login com nova senha ---');
  const res = await axios.post(`${API_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: novaSenha,
  });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login falhou: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✅ Login OK com nova senha');
  return res.data.accessToken;
}

async function test5_resetarSenhaOriginal(token: string) {
  console.log('\n--- 5. Restaurar senha original (admin reset-user-password) ---');
  const user = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });
  if (!user) throw new Error('Usuário não encontrado');
  const res = await axios.post(
    `${API_URL}/auth/reset-user-password`,
    {
      userId: user.id,
      newPassword: ADMIN_PASS,
      sendEmail: false,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status !== 200 || !res.data?.message) {
    throw new Error(`Falhou: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✅ Senha restaurada com sucesso');

  // reset-user-password define mustChangePassword=true; precisamos limpar para poder fazer login
  await axios.post(`${API_URL}/auth/change-password-required-with-credentials`, {
    email: ADMIN_EMAIL,
    currentPassword: ADMIN_PASS,
    newPassword: ADMIN_PASS,
    confirmPassword: ADMIN_PASS,
  });
  console.log('✅ Flag mustChangePassword limpa');
}

async function test6_resetarComEnvioEmail(token: string) {
  console.log('\n--- 6. Reset de senha por admin COM envio de email ---');
  const user = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });
  if (!user) throw new Error('Usuário não encontrado');
  const res = await axios.post(
    `${API_URL}/auth/reset-user-password`,
    {
      userId: user.id,
      newPassword: ADMIN_PASS,
      sendEmail: true,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status !== 200 || !res.data?.message) {
    throw new Error(`Falhou: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✅ Resposta:', res.data.message);
  const ultimo = await prisma.emailEnviado.findFirst({
    where: { tipo: 'SENHA_REDEFINIDA' },
    orderBy: { createdAt: 'desc' },
  });
  if (!ultimo) {
    throw new Error('Nenhum email SENHA_REDEFINIDA registrado');
  }
  console.log('✅ Email SENHA_REDEFINIDA registrado:', {
    destinatario: ultimo.destinatarioEmail,
    status: ultimo.status,
  });
}

async function test7_emailStatus() {
  console.log('\n--- 7. Status envio de email ---');
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (resendKey) {
    console.log('✅ Resend configurado (RESEND_API_KEY). Emails enviados via Resend.');
  } else if (smtpUser && smtpPass) {
    console.log('✅ SMTP configurado. Emails enviados via nodemailer.');
  } else {
    console.log('⚠️  Nenhum provider configurado (RESEND_API_KEY ou SMTP_USER/SMTP_PASS). Emails são simulados.');
  }
}

async function main() {
  console.log('\n=== Teste Fluxo de Email (Reset de Senha, Envio) ===');
  console.log(`API: ${API_URL}\n`);

  try {
    await test1_solicitarResetSenha();
    await test2_verificarEmailRegistrado();
    const novaSenha = await test3_confirmarResetComToken();
    const token = await test4_loginComNovaSenha(novaSenha);
    await test5_resetarSenhaOriginal(token);
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    });
    const adminToken = loginRes.data.accessToken;
    await test6_resetarComEnvioEmail(adminToken);
    await test7_emailStatus();

    console.log('\n✅ Todos os testes passaram!\n');
  } catch (err: any) {
    console.error('\n❌ Erro:', err.message || err);
    if (err.response?.data) console.error('   Resposta:', err.response.data);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
