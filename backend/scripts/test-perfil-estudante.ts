/**
 * Teste completo do perfil estudante
 *
 * Faz login com um estudante existente e testa todas as rotas do painel do aluno.
 *
 * Uso: npx tsx scripts/test-perfil-estudante.ts
 *      (será pedido email e senha interativamente)
 *
 * Ou com variáveis de ambiente:
 *   TEST_ALUNO_EMAIL=aluno@email.com TEST_ALUNO_PASSWORD=senha123 npx tsx scripts/test-perfil-estudante.ts
 */

import * as readline from 'readline';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_ALUNO_EMAIL;
const TEST_PASSWORD = process.env.TEST_ALUNO_PASSWORD;

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
  client: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    return { name, ok, status: result.status, message: ok ? undefined : JSON.stringify(result.data) };
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    return { name, ok: false, status, message: msg };
  }
}

async function main() {
  console.log('\n=== TESTE DO PERFIL ESTUDANTE ===\n');
  console.log(`API: ${API_URL}\n`);

  let email = TEST_EMAIL;
  let password = TEST_PASSWORD;

  if (!email || !password) {
    email = (await question('Email do estudante: '))?.trim() || '';
    password = (await question('Senha do estudante: '))?.trim() || '';
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

  // 1. Login
  console.log('\n1. Login...');
  const loginRes = await api.post('/auth/login', { email, password });

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    if (loginRes.status === 401) {
      console.log('   Verifique email e senha. Use: npm run script:listar-estudantes');
    }
    rl.close();
    process.exit(1);
  }

  const token = loginRes.data.accessToken;
  const user = loginRes.data.user;

  const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  if (!roles.includes('ALUNO')) {
    console.log('⚠️  Utilizador não tem role ALUNO. Roles:', roles);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  console.log(`✅ Login OK - ${user?.nomeCompleto || user?.email}`);

  const alunoId = user?.id;
  if (!alunoId) {
    console.log('❌ Não foi possível obter o ID do aluno.');
    rl.close();
    process.exit(1);
  }

  const results: TestResult[] = [];

  // 2. Perfil
  results.push(
    await runTest(api, 'GET /auth/profile', async () => {
      const r = await api.get('/auth/profile');
      return { status: r.status, data: r.data };
    })
  );

  // 3. Matrículas do aluno
  results.push(
    await runTest(api, 'GET /matriculas/aluno', async () => {
      const r = await api.get('/matriculas/aluno');
      return { status: r.status, data: r.data };
    })
  );

  // 4. Meus anos letivos
  results.push(
    await runTest(api, 'GET /matriculas-anuais/meus-anos-letivos', async () => {
      const r = await api.get('/matriculas-anuais/meus-anos-letivos');
      return { status: r.status, data: r.data };
    })
  );

  // 5. Notas do aluno
  results.push(
    await runTest(api, 'GET /notas/aluno', async () => {
      const r = await api.get('/notas/aluno');
      return { status: r.status, data: r.data };
    })
  );

  // 6. Frequência do aluno
  results.push(
    await runTest(api, 'GET /frequencias/aluno', async () => {
      const r = await api.get('/frequencias/aluno');
      return { status: r.status, data: r.data };
    })
  );

  // 8. Mensalidades do aluno
  results.push(
    await runTest(api, 'GET /mensalidades/aluno', async () => {
      const r = await api.get('/mensalidades/aluno');
      return { status: r.status, data: r.data };
    })
  );

  // 9. Eventos (calendário)
  results.push(
    await runTest(api, 'GET /eventos', async () => {
      const r = await api.get('/eventos');
      return { status: r.status, data: r.data };
    })
  );

  // 10. Comunicados (rota pública - ALUNO usa getUserComunicados → /comunicados/publicos)
  results.push(
    await runTest(api, 'GET /comunicados/publicos', async () => {
      const r = await api.get('/comunicados/publicos');
      return { status: r.status, data: r.data };
    })
  );

  // 11. Documentos do aluno
  results.push(
    await runTest(api, 'GET /documentos-aluno', async () => {
      const r = await api.get('/documentos-aluno', { params: { alunoId } });
      return { status: r.status, data: r.data };
    })
  );

  // 12. Boletim
  results.push(
    await runTest(api, 'GET /relatorios/boletim/:alunoId', async () => {
      const r = await api.get(`/relatorios/boletim/${alunoId}`);
      return { status: r.status, data: r.data };
    })
  );

  // 13. Histórico escolar (relatórios)
  results.push(
    await runTest(api, 'GET /relatorios/historico/:alunoId', async () => {
      const r = await api.get(`/relatorios/historico/${alunoId}`);
      return { status: r.status, data: r.data };
    })
  );

  // 14. Biblioteca - itens
  results.push(
    await runTest(api, 'GET /biblioteca/itens', async () => {
      const r = await api.get('/biblioteca/itens');
      return { status: r.status, data: r.data };
    })
  );

  // 15. Biblioteca - meus empréstimos
  results.push(
    await runTest(api, 'GET /biblioteca/meus-emprestimos', async () => {
      const r = await api.get('/biblioteca/meus-emprestimos');
      return { status: r.status, data: r.data };
    })
  );

  // 16. Matrículas anuais por aluno (se a rota permitir ALUNO)
  results.push(
    await runTest(api, 'GET /matriculas-anuais/aluno/:alunoId', async () => {
      const r = await api.get(`/matriculas-anuais/aluno/${alunoId}`);
      return { status: r.status, data: r.data };
    })
  );

  rl.close();

  // Relatório
  console.log('\n=== RESULTADOS ===\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    const status = r.status ? ` (${r.status})` : '';
    console.log(`${icon} ${r.name}${status}`);
    if (!r.ok && r.message) {
      console.log(`   └─ ${String(r.message).substring(0, 80)}${(r.message as string).length > 80 ? '...' : ''}`);
    }
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);

  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    console.log('   Verifique se as rotas estão protegidas com authorize("ALUNO") e se o backend está a filtrar por aluno_id.');
    process.exit(1);
  }

  console.log('\n✅ Todos os testes do perfil estudante passaram!\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  rl.close();
  process.exit(1);
});
