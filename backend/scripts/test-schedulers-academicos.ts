#!/usr/bin/env npx tsx
/**
 * Teste dos schedulers académicos (abertura automática)
 * Verifica que os serviços executam sem erro (não quebra)
 * Uso: MOCK_API=1 npx tsx scripts/test-schedulers-academicos.ts
 */
import { AnoLetivoSchedulerService } from '../src/services/anoLetivoScheduler.service.js';
import { SemestreSchedulerService } from '../src/services/semestreScheduler.service.js';
import { TrimestreSchedulerService } from '../src/services/trimestreScheduler.service.js';
import { PeriodoLancamentoNotasSchedulerService } from '../src/services/periodoLancamentoNotasScheduler.service.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTE SCHEDULERS ACADÉMICOS (abertura automática)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let ok = 0;
  let fail = 0;

  // 1. Ano Letivo
  try {
    const r1 = await AnoLetivoSchedulerService.processarAberturaAutomatica();
    console.log('✓ AnoLetivoScheduler:', { anosAtivados: r1.anosAtivados, erros: r1.erros.length });
    if (r1.erros.length > 0) console.log('  Erros:', r1.erros);
    ok++;
  } catch (e) {
    console.error('✗ AnoLetivoScheduler:', e);
    fail++;
  }

  // 2. Semestre
  try {
    const r2 = await SemestreSchedulerService.processarInicioAutomatico();
    console.log('✓ SemestreScheduler:', {
      semestresIniciados: r2.semestresIniciados,
      alunosAtualizados: r2.alunosAtualizados,
      erros: r2.erros.length,
    });
    if (r2.erros.length > 0) console.log('  Erros:', r2.erros);
    ok++;
  } catch (e) {
    console.error('✗ SemestreScheduler:', e);
    fail++;
  }

  // 3. Trimestre
  try {
    const r3 = await TrimestreSchedulerService.processarAberturaAutomatica();
    console.log('✓ TrimestreScheduler:', {
      trimestresAtivados: r3.trimestresAtivados,
      alunosAtualizados: r3.alunosAtualizados,
      erros: r3.erros.length,
    });
    if (r3.erros.length > 0) console.log('  Erros:', r3.erros);
    ok++;
  } catch (e) {
    console.error('✗ TrimestreScheduler:', e);
    fail++;
  }

  // 4. Períodos de Lançamento de Notas
  try {
    const r4 = await PeriodoLancamentoNotasSchedulerService.processarAberturaAutomatica();
    console.log('✓ PeriodoLancamentoNotasScheduler:', {
      periodosAbertos: r4.periodosAbertos,
      erros: r4.erros.length,
    });
    if (r4.erros.length > 0) console.log('  Erros:', r4.erros);
    ok++;
  } catch (e) {
    console.error('✗ PeriodoLancamentoNotasScheduler:', e);
    fail++;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${ok}/4 serviços executaram sem erro`);
  if (fail > 0) {
    console.error(`  FALHAS: ${fail}`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
