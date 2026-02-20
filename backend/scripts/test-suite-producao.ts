#!/usr/bin/env npx tsx
/**
 * SUITE DE TESTES PARA PRODUÇÃO - DSICOLA
 *
 * Executa o Plano de Teste Completo conforme docs/PLANO_TESTE_DSICOLA.md:
 * - Multi-tenancy e segurança
 * - Perfis: ADMIN, SECRETARIA, PROFESSOR, ALUNO, POS
 * - Gestão acadêmica (planos, turmas, matrículas)
 * - Recibos e financeiro
 * - Relatórios e documentos
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:suite-producao
 */
import { spawn } from 'child_process';
import path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  categoria: string;
  nome: string;
  script: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
}

function runScript(scriptName: string): Promise<{ exitCode: number; durationMs: number }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const start = Date.now();

    const child = spawn('npx', ['tsx', scriptPath], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, API_URL },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    child.stdout?.on('data', (d) => { out += d.toString(); process.stdout.write(d); });
    child.stderr?.on('data', (d) => { out += d.toString(); process.stderr.write(d); });

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, durationMs: Date.now() - start });
    });
    child.on('error', () => {
      resolve({ exitCode: 1, durationMs: Date.now() - start });
    });
  });
}

const TESTES: Array<{ categoria: string; nome: string; script: string }> = [
  // 1. Multi-tenancy e segurança
  { categoria: 'Multi-tenancy', nome: 'Isolamento e RBAC', script: 'test-multi-tenant-seguranca.ts' },
  { categoria: 'Multi-tenancy', nome: 'Diferenciação Sec/Sup', script: 'test-diferenciacao-secundario-superior.ts' },

  // 2. Perfis e roles
  { categoria: 'Perfis', nome: 'ADMIN', script: 'test-admin-fluxo-completo.ts' },
  { categoria: 'Perfis', nome: 'SECRETARIA', script: 'test-secretaria-fluxo-completo.ts' },
  { categoria: 'Perfis', nome: 'PROFESSOR', script: 'test-professor-fluxo-completo.ts' },
  { categoria: 'Perfis', nome: 'ESTUDANTE (ALUNO)', script: 'test-estudante-fluxo-completo.ts' },
  { categoria: 'Perfis', nome: 'POS / Financeiro', script: 'test-pos-fluxo-completo.ts' },

  // 3. Gestão acadêmica
  { categoria: 'Acadêmico', nome: 'Planos Sec+Sup', script: 'test-fluxo-planos-secundario-superior.ts' },
  { categoria: 'Acadêmico', nome: 'Plano Ensino Secundário', script: 'test-plano-ensino-fluxo-completo-secundario.ts' },
  { categoria: 'Acadêmico', nome: 'Matrícula Turma Disciplina', script: 'test-matricula-turma-disciplina.ts' },

  // 4. Recibos e financeiro
  { categoria: 'Financeiro', nome: 'Recibo Completo (Sec+Sup)', script: 'test-recibo-completo.ts' },
  { categoria: 'Financeiro', nome: 'RH e Financeiro', script: 'test-rh-financeiro-perfis.ts' },

  // 5. Segurança e critérios
  { categoria: 'Segurança', nome: 'Critério e RBAC', script: 'test-criterio-seguranca.ts' },

  // 6. Infraestrutura
  { categoria: 'Infra', nome: 'Infraestrutura', script: 'test-infraestrutura.ts' },
];

function runSeed(): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'seed-multi-tenant-test.ts');
    const child = spawn('npx', ['tsx', scriptPath], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => resolve({ exitCode: code ?? 1 }));
    child.on('error', () => resolve({ exitCode: 1 }));
  });
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  DSICOLA - SUITE DE TESTES PARA PRODUÇÃO                                       ║');
  console.log('║  Plano de Teste Completo | Multi-tenant | Secundário + Superior               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`API: ${API_URL}`);
  console.log(`Total: ${TESTES.length} testes`);
  console.log('Ver: docs/PLANO_TESTE_DSICOLA.md\n');

  console.log('  ▶ Seed multi-tenant (pré-requisito)...');
  const seedResult = await runSeed();
  if (seedResult.exitCode !== 0) {
    console.warn('  ⚠ Seed retornou código não-zero. Continuando - pode faltar dados de teste.\n');
  } else {
    console.log('  ✅ Seed OK\n');
  }

  const results: TestResult[] = [];
  let categoriaAtual = '';

  for (const t of TESTES) {
    if (t.categoria !== categoriaAtual) {
      categoriaAtual = t.categoria;
      console.log('\n' + '─'.repeat(70));
      console.log(`  📁 ${categoriaAtual}`);
      console.log('─'.repeat(70));
    }

    console.log(`\n  ▶ ${t.nome} (${t.script})`);
    const { exitCode, durationMs } = await runScript(t.script);
    const passed = exitCode === 0;

    results.push({
      categoria: t.categoria,
      nome: t.nome,
      script: t.script,
      passed,
      exitCode,
      durationMs,
    });

    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${t.nome}: ${passed ? 'OK' : 'FALHOU'} (${(durationMs / 1000).toFixed(1)}s)`);
  }

  // ─── RELATÓRIO FINAL ─────────────────────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  RELATÓRIO - CRITÉRIOS DE ACEITAÇÃO PRODUÇÃO                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const byCat = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!byCat.has(r.categoria)) byCat.set(r.categoria, []);
    byCat.get(r.categoria)!.push(r);
  }

  for (const [cat, arr] of byCat) {
    const ok = arr.filter((r) => r.passed).length;
    const total = arr.length;
    const status = ok === total ? '✅' : '❌';
    console.log(`${status} ${cat}: ${ok}/${total}`);
    if (ok < total) {
      arr.filter((r) => !r.passed).forEach((r) => console.log(`     • ${r.nome}`));
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  TOTAL: ${passedCount}/${totalCount} testes passaram (${percent}%)`);
  console.log('─'.repeat(70));

  if (passedCount < totalCount) {
    console.log('\n❌ Suite NÃO aprovada para produção. Corrija os testes falhados.\n');
    process.exit(1);
  }

  console.log(`
✅ Todos os critérios de aceitação foram atendidos:
  • Fluxos funcionam sem erro
  • Perfis acessam apenas o permitido
  • Multi-tenancy com isolamento total
  • Recibos e relatórios com dados corretos
  • Sistema estável e confiável

Sistema APROVADO para produção.
`);
  console.log('═'.repeat(70));
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
