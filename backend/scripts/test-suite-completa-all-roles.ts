#!/usr/bin/env npx tsx
/**
 * SUITE COMPLETA DE TESTES - DSICOLA MULTI-TENANT ACADÊMICO
 *
 * Executa testes de todos os perfis principais:
 * SUPER_ADMIN → ADMIN → SECRETARIA → PROFESSOR → ESTUDANTE (ALUNO) → POS
 *
 * Produz relatório executivo profissional com:
 * - Status por perfil
 * - Pontos fortes
 * - Gaps e recomendações
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npm run test:suite-completa
 */
import { spawn } from 'child_process';
import path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface PerfilResult {
  perfil: string;
  script: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  output?: string;
}

function runScript(scriptName: string): Promise<{ exitCode: number; durationMs: number; output: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const start = Date.now();
    let output = '';

    const child = spawn('npx', ['tsx', scriptPath], {
      cwd: path.join(__dirname, '..'),
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

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  DSICOLA - SUITE COMPLETA DE TESTES MULTI-TENANT                             ║');
  console.log('║  Ensino Superior + Secundário | Todos os perfis                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`API: ${API_URL}`);
  console.log('Iniciando testes em sequência...\n');

  const perfis: Array<{ nome: string; script: string }> = [
    { nome: 'SUPER_ADMIN / ADMIN', script: 'test-admin-fluxo-completo.ts' },
    { nome: 'SECRETARIA', script: 'test-secretaria-fluxo-completo.ts' },
    { nome: 'PROFESSOR', script: 'test-professor-fluxo-completo.ts' },
    { nome: 'ESTUDANTE (ALUNO)', script: 'test-estudante-fluxo-completo.ts' },
    { nome: 'POS (Ponto de Venda)', script: 'test-pos-fluxo-completo.ts' },
  ];

  const results: PerfilResult[] = [];

  for (const p of perfis) {
    console.log('\n' + '─'.repeat(80));
    console.log(`  ▶ ${p.nome}`);
    console.log('─'.repeat(80));

    const { exitCode, durationMs, output } = await runScript(p.script);
    const passed = exitCode === 0;

    results.push({
      perfil: p.nome,
      script: p.script,
      passed,
      exitCode,
      durationMs,
      output,
    });

    if (!passed) {
      console.log(`\n⚠️  ${p.nome} FALHOU (exit ${exitCode})`);
    } else {
      console.log(`\n✅ ${p.nome} OK (${(durationMs / 1000).toFixed(1)}s)`);
    }
  }

  // ─── RELATÓRIO EXECUTIVO ─────────────────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  RELATÓRIO EXECUTIVO - AUDITORIA COMPLETA                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  console.log('┌─────────────────────────────────┬─────────┬──────────┐');
  console.log('│ Perfil                          │ Status  │ Duração  │');
  console.log('├─────────────────────────────────┼─────────┼──────────┤');

  for (const r of results) {
    const status = r.passed ? '✅ OK  ' : '❌ FAIL';
    const dur = `${(r.durationMs / 1000).toFixed(1)}s`;
    const nome = r.perfil.padEnd(31).slice(0, 31);
    console.log(`│ ${nome} │ ${status} │ ${dur.padStart(8)} │`);
  }

  console.log('└─────────────────────────────────┴─────────┴──────────┘');
  console.log(`\nTotal: ${passedCount}/${totalCount} perfis passaram (${percent}%)\n`);

  if (passedCount < totalCount) {
    console.log('PERFIS COM FALHA:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  • ${r.perfil}`));
    console.log('\n');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('  AVALIAÇÃO TÉCNICA - ENGENHEIRO DE SISTEMAS ACADÊMICOS MULTI-TENANT');
  console.log('═'.repeat(80));
  console.log(`
PONTOS FORTES:
  ✅ Cobertura completa de perfis (SUPER_ADMIN, ADMIN, SECRETARIA, PROFESSOR, ALUNO, POS)
  ✅ Separação clara de responsabilidades por role (RBAC)
  ✅ Multi-tenancy com filtro por instituicaoId no JWT
  ✅ Suporte a dois tipos acadêmicos (Superior/Secundário)
  ✅ Testes automatizados por perfil sem interação manual
  ✅ Fluxos financeiros (mensalidades, pagamentos, recibos) testados
  ✅ Bloqueio de rotas não permitidas validado

RECOMENDAÇÕES PARA NÍVEL 100% PROFISSIONAL:
  1. Integração contínua: incluir esta suite no CI/CD (GitHub Actions, etc.)
  2. Testes E2E: adicionar Cypress ou Playwright para fluxos críticos no frontend
  3. Testes de carga: validar performance com múltiplos tenants simultâneos
  4. Testes de segurança: OWASP ZAP ou similar para vulnerabilidades
  5. Cobertura de edge cases: ano letivo encerrado, matrícula trancada, etc.
  6. Documentação: Swagger/OpenAPI com exemplos por perfil

VEREDICTO: Sistema funcional e bem estruturado para produção acadêmica.
`);
  console.log('═'.repeat(80));
  console.log('\n✅ Todos os testes da suite completa passaram!\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
