#!/usr/bin/env npx tsx
/**
 * Teste do assistente de IA
 * Verifica se o endpoint /ai/assistant responde corretamente
 *
 * Uso: npx tsx scripts/test-ai-assistant.ts
 * Requer: Backend rodando, usuário autenticado (token de um utilizador válido)
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function getToken(): Promise<string> {
  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    email: process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com',
    password: process.env.TEST_ADMIN_PASS || 'SuperAdmin@123',
  });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    throw new Error('Login falhou. Verifique credenciais.');
  }
  return loginRes.data.accessToken;
}

async function main() {
  console.log('\n=== Teste Assistente IA ===\n');
  console.log(`API: ${API_URL}\n`);

  try {
    const token = await getToken();
    console.log('✅ Login OK\n');

    const response = await axios.post(
      `${API_URL}/ai/assistant`,
      {
        messages: [{ role: 'user', content: 'Olá! O que você pode fazer?' }],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    if (response.status === 200 && response.data?.response) {
      console.log('✅ Assistente IA respondeu corretamente:\n');
      console.log('Resposta:', response.data.response.slice(0, 200) + (response.data.response.length > 200 ? '...' : ''));
      console.log('\n✅ Teste passou!');
    } else {
      console.log('⚠️  Resposta inesperada:', response.status, response.data);
    }
  } catch (err: any) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('❌ Erro:', status || err.message);
    if (data?.response) console.log('   Mensagem:', data.response);
    if (data?.message) console.log('   Mensagem:', data.message);
    process.exit(1);
  }
}

main();
