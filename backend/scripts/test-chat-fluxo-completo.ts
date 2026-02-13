#!/usr/bin/env npx tsx
/**
 * TESTE DE FLUXO COMPLETO: Módulo Chat
 *
 * 1. Login professor
 * 2. Listar threads (vazio inicial)
 * 3. Criar thread DISCIPLINA (professor vinculado)
 * 4. Enviar mensagem
 * 5. Buscar mensagens
 * 6. Marcar como lido
 * 7. Contagem de não lidas
 *
 * Requer: Backend rodando em http://localhost:3001
 *        Migration add_chat_module aplicada
 * Uso: npx tsx scripts/test-chat-fluxo-completo.ts
 *      TEST_PROFESSOR_EMAIL=prof@email.com TEST_PROFESSOR_PASSWORD=senha npx tsx scripts/test-chat-fluxo-completo.ts
 *      TEST_DISCIPLINA_ID=uuid npx tsx scripts/test-chat-fluxo-completo.ts  (opcional, busca auto se omitido)
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_PROFESSOR_EMAIL;
const TEST_PASSWORD = process.env.TEST_PROFESSOR_PASSWORD;
const TEST_DISCIPLINA_ID = process.env.TEST_DISCIPLINA_ID;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  status?: number;
}

async function runTest(
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    return { name, ok, status: result.status, message: ok ? undefined : JSON.stringify(result.data) };
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    return { name, ok: false, status, message: msg };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - Módulo Chat');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  let email = TEST_EMAIL;
  let password = TEST_PASSWORD;
  let disciplinaId = TEST_DISCIPLINA_ID;

  if (!email || !password) {
    email = (await question('Email do professor: '))?.trim() || '';
    password = (await question('Senha: '))?.trim() || '';
  }

  if (!email || !password) {
    console.log('❌ Email e senha obrigatórios.');
    rl.close();
    process.exit(1);
  }

  const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // --- 1. LOGIN ---
  console.log('\n1. Login...');
  const loginRes = await api.post('/auth/login', { email, password });

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    rl.close();
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`✅ Login OK - ${user?.nomeCompleto || user?.email}`);

  // --- 2. Obter disciplinaId (professor via plano-ensino, ou env) ---
  if (!disciplinaId) {
    const planoRes = await api.get('/plano-ensino');
    const planos = Array.isArray(planoRes.data) ? planoRes.data : planoRes.data?.data || planoRes.data?.planos || [];
    const plano = planos.find((p: any) => p.disciplinaId) || planos[0];
    if (plano?.disciplinaId) {
      disciplinaId = plano.disciplinaId;
      console.log(`\n2. Disciplina do plano: ${plano.disciplina?.nome || plano.disciplinaId} (${disciplinaId})`);
    } else {
      disciplinaId = (await question('disciplinaId (UUID): '))?.trim() || '';
    }
  }

  // --- 3. GET /chat/threads ---
  results.push(
    await runTest('GET /chat/threads - listar conversas', async () => {
      const res = await api.get('/chat/threads');
      return { status: res.status, data: res.data };
    })
  );

  if (!disciplinaId) {
    results.push({ name: 'disciplinaId obrigatório para thread DISCIPLINA', ok: false, message: 'Forneça TEST_DISCIPLINA_ID ou selecione disciplina' });
  } else {
    // --- 4. POST /chat/threads (DISCIPLINA) ---
    results.push(
      await runTest('POST /chat/threads - criar thread DISCIPLINA', async () => {
        const res = await api.post('/chat/threads', {
          tipo: 'DISCIPLINA',
          disciplinaId,
        });
        return { status: res.status, data: res.data };
      })
    );

    const threadsRes = await api.get('/chat/threads');
    const thread = Array.isArray(threadsRes.data) && threadsRes.data.length > 0 ? threadsRes.data[0] : null;

    if (thread?.id) {
      console.log(`   Thread criada: ${thread.id}`);

      // --- 5. POST /chat/threads/:id/messages ---
      results.push(
        await runTest('POST /chat/threads/:id/messages - enviar mensagem', async () => {
          const res = await api.post(`/chat/threads/${thread.id}/messages`, {
            content: 'Olá turma! Teste de mensagem do fluxo completo.',
          });
          return { status: res.status, data: res.data };
        })
      );

      // --- 6. GET /chat/threads/:id/messages ---
      results.push(
        await runTest('GET /chat/threads/:id/messages - buscar mensagens', async () => {
          const res = await api.get(`/chat/threads/${thread.id}/messages?limit=10`);
          return { status: res.status, data: res.data };
        })
      );

      // --- 7. PATCH /chat/threads/:id/read ---
      results.push(
        await runTest('PATCH /chat/threads/:id/read - marcar como lido', async () => {
          const res = await api.patch(`/chat/threads/${thread.id}/read`);
          return { status: res.status, data: res.data };
        })
      );

      // --- 8. GET /chat/unread-count ---
      results.push(
        await runTest('GET /chat/unread-count - contagem não lidas', async () => {
          const res = await api.get('/chat/unread-count');
          return { status: res.status, data: res.data };
        })
      );
    } else if (results[results.length - 1]?.ok === false) {
      console.log('   (Thread não criada - professor pode não estar vinculado à disciplina)');
    }
  }

  // --- RESUMO ---
  console.log('\n═══════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`  RESULTADO: ${passed}/${results.length} testes passaram`);
  if (failed.length > 0) {
    console.log('\n  Falhas:');
    failed.forEach((f) => {
      console.log(`    ❌ ${f.name}: ${f.message || f.status}`);
    });
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  rl.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
