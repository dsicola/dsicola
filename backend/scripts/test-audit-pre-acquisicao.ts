#!/usr/bin/env npx tsx
/**
 * AUDITORIA COMPLETA - PRÉ-AQUISIÇÃO DSICOLA
 *
 * Executa todos os testes críticos antes de venda a instituto.
 * Módulos: Super-Admin, Admin, Secretaria, Professor, Alunos, Certificados,
 * Moradias (Alojamentos), Financeiro, Relatórios, Backup.
 *
 * Uso: npx tsx scripts/test-audit-pre-acquisicao.ts
 * Requer: Backend rodando em http://localhost:3001 (para testes API)
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface AuditResult {
  categoria: string;
  script: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  output?: string;
}

function runScript(scriptName: string, args: string[] = []): Promise<{ exitCode: number; durationMs: number; output: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const start = Date.now();
    let output = '';
    const cmd = args.length ? ['tsx', scriptPath, ...args] : ['tsx', scriptPath];

    const child = spawn('npx', cmd, {
      cwd: ROOT,
      env: { ...process.env, API_URL },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (d) => {
      output += d.toString();
      process.stdout.write(d);
    });
    child.stderr?.on('data', (d) => {
      output += d.toString();
      process.stderr.write(d);
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - start;
      resolve({ exitCode: code ?? 1, durationMs, output });
    });

    child.on('error', (err) => {
      resolve({ exitCode: 1, durationMs: Date.now() - start, output: err.message });
    });
  });
}

async function checkBackendUp(): Promise<boolean> {
  try {
    const { default: axios } = await import('axios');
    const r = await axios.get(`${API_URL}/health`, { timeout: 3000 });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  AUDITORIA COMPLETA DSICOLA - PRÉ-AQUISIÇÃO                                   ║');
  console.log('║  Super-Admin | Admin | Secretaria | Professor | Alunos | Certificados | Moradias  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const results: AuditResult[] = [];

  // 1. Infraestrutura (não precisa de backend)
  console.log('─'.repeat(80));
  console.log('  ▶ 1. INFRAESTRUTURA');
  console.log('─'.repeat(80));
  const infra = await runScript('test-infraestrutura.ts');
  results.push({
    categoria: 'Infraestrutura',
    script: 'test-infraestrutura.ts',
    passed: infra.exitCode === 0,
    exitCode: infra.exitCode,
    durationMs: infra.durationMs,
    output: infra.output,
  });

  // 2. Backend build
  console.log('\n' + '─'.repeat(80));
  console.log('  ▶ 2. BACKEND BUILD');
  console.log('─'.repeat(80));
  const buildBackend = await new Promise<{ exitCode: number; durationMs: number }>((resolve) => {
    const start = Date.now();
    const child = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve({ exitCode: code ?? 1, durationMs: Date.now() - start }));
  });
  results.push({
    categoria: 'Backend Build',
    script: 'npm run build',
    passed: buildBackend.exitCode === 0,
    exitCode: buildBackend.exitCode,
    durationMs: buildBackend.durationMs,
  });

  // 3. Vitest (unit tests)
  console.log('\n' + '─'.repeat(80));
  console.log('  ▶ 3. UNIT TESTS (Vitest)');
  console.log('─'.repeat(80));
  const vitest = await new Promise<{ exitCode: number; durationMs: number }>((resolve) => {
    const start = Date.now();
    const child = spawn('npm', ['run', 'test'], { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve({ exitCode: code ?? 1, durationMs: Date.now() - start }));
  });
  results.push({
    categoria: 'Unit Tests (Vitest)',
    script: 'npm run test',
    passed: vitest.exitCode === 0,
    exitCode: vitest.exitCode,
    durationMs: vitest.durationMs,
  });

  // 4. Verificar backend e rodar suite API
  const backendUp = await checkBackendUp();
  if (!backendUp) {
    console.log('\n⚠️  Backend não está rodando em ' + API_URL + '. Inicie com: cd backend && npm run dev');
    console.log('   Testes de API serão pulados.\n');
    results.push({
      categoria: 'Suite API (Admin+Secretaria+Professor+Aluno+POS)',
      script: 'test-suite-completa-all-roles.ts',
      passed: false,
      exitCode: -1,
      durationMs: 0,
      output: 'Backend não disponível',
    });
  } else {
    console.log('\n' + '─'.repeat(80));
    console.log('  ▶ 4. SUITE COMPLETA API (todos os perfis)');
    console.log('─'.repeat(80));
    const suite = await runScript('test-suite-completa-all-roles.ts');
    results.push({
      categoria: 'Suite API (Admin+Secretaria+Professor+Aluno+POS)',
      script: 'test-suite-completa-all-roles.ts',
      passed: suite.exitCode === 0,
      exitCode: suite.exitCode,
      durationMs: suite.durationMs,
      output: suite.output,
    });
  }

  // 5. Frontend build
  console.log('\n' + '─'.repeat(80));
  console.log('  ▶ 5. FRONTEND BUILD');
  console.log('─'.repeat(80));
  const frontendRoot = path.resolve(ROOT, '../frontend');
  const buildFrontend = await new Promise<{ exitCode: number; durationMs: number }>((resolve) => {
    const start = Date.now();
    const child = spawn('npm', ['run', 'build'], { cwd: frontendRoot, stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve({ exitCode: code ?? 1, durationMs: Date.now() - start }));
  });
  results.push({
    categoria: 'Frontend Build',
    script: 'npm run build (frontend)',
    passed: buildFrontend.exitCode === 0,
    exitCode: buildFrontend.exitCode,
    durationMs: buildFrontend.durationMs,
  });

  // ─── RELATÓRIO FINAL ────────────────────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  RELATÓRIO DE AUDITORIA - PRÉ-AQUISIÇÃO                                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  console.log('┌────────────────────────────────────────────────────┬─────────┬──────────┐');
  console.log('│ Categoria                                            │ Status  │ Duração  │');
  console.log('├────────────────────────────────────────────────────┼─────────┼──────────┤');

  for (const r of results) {
    const status = r.passed ? '✅ OK  ' : '❌ FAIL';
    const dur = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : '—';
    const nome = r.categoria.padEnd(50).slice(0, 50);
    console.log(`│ ${nome} │ ${status} │ ${dur.padStart(8)} │`);
  }

  console.log('└────────────────────────────────────────────────────┴─────────┴──────────┘');
  console.log(`\nTotal: ${passedCount}/${totalCount} categorias passaram (${percent}%)\n`);

  if (passedCount < totalCount) {
    console.log('CATEGORIAS COM FALHA:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  • ${r.categoria}`));
    console.log('\n');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('  SISTEMA APROVADO PARA APRESENTAÇÃO A INSTITUTO');
  console.log('═'.repeat(80));
  console.log(`
MÓDULOS VALIDADOS:
  ✅ Infraestrutura (variáveis, banco, backups)
  ✅ Backend (build, unit tests)
  ✅ Frontend (build)
  ✅ Super-Admin (login, instituições, planos)
  ✅ Admin (cursos, classes, disciplinas, anos letivos, turmas)
  ✅ Professores e Plano de Ensino
  ✅ Matrículas e Estudantes
  ✅ Notas e Avaliações
  ✅ Aulas e Frequências
  ✅ Moradias (Alojamentos)
  ✅ Certificados (Conclusão de Curso)
  ✅ Documentos oficiais
  ✅ Secretaria, Professor, Aluno, POS (fluxos completos)
  ✅ Financeiro (mensalidades, pagamentos)
  ✅ Comunicados e Turnos

Execute com backend rodando para validar todas as APIs.
`);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
